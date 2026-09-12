# Phase 10: Performance and Large Data Volumes

Performance questions dominate the PDII exam's 18% "Performance" domain and quietly infect every other section: every SOQL, DML, and loop either respects governor limits or is a bug waiting for Scale. This phase turns "query limit" folklore into a measurable engineering practice.

## Learning Objectives

By the end of this phase, you will be able to:
- Recite the core synchronous governor limits and predict where they break.
- Distinguish selective vs non-selective queries and interact with the Query Plan tool.
- Replace nested-loop (O(n*m)) logic with Map joins (O(n+m)).
- Use indexes, custom indexes, and skinny tables appropriately; understand Big Objects.
- Choose batch Apex/QueryLocator to move millions of records in chunks.
- Recognise lookups-vs-formulas and in-memory-vs-DML trade-offs.

## 1. Governor Limits: The Numbers That Decide Everything

The synchronous numbers you must know cold (Phase 5 covered the async upgrades):

| Resource | Sync limit | Async upgrade |
|----------|-----------|---------------|
| SOQL queries | **100** | 200 |
| Query rows retrieved | **50,000** | 200,000 (batch `execute`); `QueryLocator` (start) is the streaming escape |
| DML statements | **150** | 150 |
| DML rows processed | **10,000** | 10,000 per batch chunk |
| Heap | **6 MB** | 12 MB |
| CPU time | **10 s** | 60 s |
| Callouts (sync) | **10** | 10 |
| SOSL searches | 20 | 20 for the entire request |

Three recurring failure modes the exam stages:

1. **"Too many SOQL queries"** — queries inside a loop (Phase 3/4 fixes: maps, one query).
2. **"Too many records retrieved"** — a SOQL returning >50,000 rows instead of being bounded by `LIMIT`/filters.
3. **"CPU time limit exceeded"** — string/collection work in O(n*m) loops (Map join) or heavy flows of the same data.

Guardians: `Limits.getQueries()`/`getLimitQueries()`, `Limits.getQueryRows()`, `Limits.getCpuTime()`, `System.debug` snapshots before/after stages. `DeveloperFundamentalsTest` models the introspection habit; the exam will hand you a code snippet and ask "which governor fires first?" — answers hinge on the numbers above.

## 2. Selective Queries and the Query Plan Tool

A **selective query** reaches records via an **index** instead of scanning every row. The "index points" definition the platform uses: roughly 10% of records for the first million, 5% for two million, then 4% (with a cap around four million rows). Queries that escape an index—`LIKE '%x%'` leading wildcard, unmatched negation, functions on indexed fields (`WHERE DAY_ONLY(CreatedDate) = TODAY`)—are non-selective, and the platform may **fall back to a full-table scan** and (for the classic case) throw a "non-selective query" `UnsupportedOperationException` on Salesforce objects with more data than FilteredLookup-style rules allow.

Practice: design `WHERE` clauses around **indexed fields**:

- Standard indexes already exist on `Id`, `Name`, `OwnerId`, `CreatedById`, `LastModifiedById`, `CreatedDate`, `LastModifiedDate`, `SystemModstamp`, record type, and most unique/external-ID fields.
- **Custom indexes** can be added to custom fields (and certain standard fields) under Setup → Object Manager → field → indexed. A lookup field gets its own index; a custom checkbox doesn't by default.
- Order of selectivity: filter on the *most* selective condition first; add a compound index (`Add Filtered Index` in newer APIs) when a field alone isn't selective enough.
- `LIMIT` bound queries can still be non-selective — the planner must first locate rows.

**Query Plan** (Developer Console → Query Plan tab) shows you: the indexes the optimizer considered, the estimated cost, and the cardinality of each filter. `PerformanceService.rebuildHealthScores` accepts a caller-supplied query precisely so you can paste variants into Query Plan before deploying and compare "uses index on Health_Score__c" vs "table scan".

Selectivity rules of thumb to memorise for the exam:

- `=` on an indexed field is selective. `IN` on indexed values is selective for reasonable sets.
- **Wildcard prefixes kill selectivity**: `LIKE 'ACME%'` is ok; `LIKE '%ACME%'` is not.
- `!=` is `<>`, `NOT LIKE`, and `NOT IN`-style prefixed negations are notoriously non-selective.
- `OR` conditions could combine poorly (compound logical-cost analysis).
- **Filtered/compound indexes**: compound indexes (`Name + Industry`) help "OR across columns" and the selective results can be bounded; PDII expects you to name when a compound index rescues a query.

## 3. Maps Beat Nested Loops: O(n+m) vs O(n*m)

The anti-pattern is a nested loop comparing every element of two collections:

```apex
for (Account a : accounts) {
    for (Contact c : contacts) {        // O(n*m) comparisons
        if (c.AccountId == a.Id) { /* ... */ }
    }
}
```

The Map join buckets the smaller side by key once, then looks up per row:

```apex
public static Map<Id, List<Contact>> slotContactsByAccount(List<Contact> contacts) {
    Map<Id, List<Contact>> byAccount = new Map<Id, List<Contact>>();
    for (Contact c : contacts) {
        if (c.AccountId == null) continue;
        if (!byAccount.containsKey(c.AccountId)) byAccount.put(c.AccountId, new List<Contact>());
        byAccount.get(c.AccountId).add(c);
    }
    return byAccount;          // O(n) build + O(m) lookups
}
```

Use the Map over the *children grouped by key* and then iterate the parent rows (`Map<Id,List<Contact>>` → for each Account, `byAccount.get(acc.Id)`). `PerformanceService.slotContactsByAccount` + `topAccountsByScore` are the repo's canonical pair; `PerformanceServiceTest.mapJoinBucketsContactsByAccountId` proves orphans are skipped and buckets hold the right counts.

Wider performance habits that pair with Map joins:

- **Aggregate before you join**: prefer one `GROUP BY` query to per-parent counts (see `countContactsByAccount`).
- **Restrict fields**: select only what you use; heavy, wide objects cost heap (6 MB sync).
- **Background the heavy read**: batch/queueable where the row set is large (Phase 5).

## 4. Lookups vs Formulas: Read Often, Compute Cheap

**Formula fields** recompute on each read/save; **roll-up summary fields** aggregate child records into the parent. Both add cost at scale:

| Pattern | Cost at read | Cost at write |
|---------|--------------|---------------|
| Lookup + relationship query | 1 extra query per hop (or dot-notation cost) | free |
| Formula field | recompute per row returned | recompute on save |
| Roll-up summary | cached on parent | recalculation of parent's child aggregate on every child DML |

Rule of thumb: store *precomputed* values (like `Health_Score__c`) when a value is read far more often than it changes, and derive-on-read only when the compute is cheap and the read rate low. The repo's `Health_Score__c` is exactly the stored-score pattern, recalculated by `rebuildHealthScores` in a scheduled batch instead of recomputed on every query.

## 5. Batch Apex for the Millions (and Beyond)

When data passes the 50k/10k row budget, stop trying to touch it in one transaction:

- `Database.executeBatch(instance, scope)` with **scope default 200, max 2000** chunks work.
- `start()` returning **`Database.QueryLocator`** streams rows with no 50,000 cap — batch over millions of rows. (Iterable-based scopes are capped at 50k per chunk.)
- Each chunk is its **own transaction**: its own CPU (60 s async), DML (10k rows), and SOQL (200) budget.
- `Database.Stateful` keeps _per-job_ counters; finish() aggregates.
- Never call `executeBatch` from inside an *active* batch `execute` (chained batches must be enqueued in `finish` or via queueable) — the platform forbids new batch jobs from within a running batch (except `finish`, which is allowed).

The repo's `HealthScoreRecalculator` is the reference implementation: `QueryLocator` over every `Account`, clamp in memory, one `update` per 200-row chunk, `finish` notes completion.

## 6. Storage and Scale Tools: Custom Indexes, Skinny Tables, Big Objects

**Custom indexes** make otherwise-unindexed filters selective (see Section 2). Beyond that, three names the exam drops:

- **Skinny tables** — platform-maintained, denormalized tables containing a small subset of columns of a *selectively queried* object (commonly the heaviest objects like Account/Opportunity). Queries against heavy objects can be redirected to the skinny table to avoid hauling wide rows through every scan; created/administered carefully (typically with platform assistance for orgs licensed for it). They are *not* a developer-day-to-day tool, but they are the correct answer to "some fields are read constantly and nothing else".
- **Big Objects** (`__b`) — objects capable of storing **billions of records** for archiving/analytics use cases. Hard facts: data is immutable after ingestion; every query must reference an **indexed field** (custom or standard); you may query with SOQL from Apex but Big Objects don't support `GROUP BY`/aggregates the way standard objects do, and you can't create trigger/rollups/cascade relationships with them. They solve "query records beyond normal row records" (e.g., log archives).
- **External objects / External Data Sources** — data virtualised from outside, queried with SOQL configured via an adapter; they cover the "huge external data" scenario without copying it in.

Match each to its exam scenario: "large-volume read of a few fields every time" → skinny table; "append-only archive beyond millions" → Big Object; "index a filter that is hot" → custom/compound index.

## 7. DML and Memory Hygiene

- **One DML statement groups many rows**: always `insert/update delete list`. "150 DML statements" refers to statements, not rows — a loop of single-record updates is the top way to detonate that limit, followed by "10,000 DML rows" on a batch upsert.
- **In-memory first**: normalize/clamp/derive values on the records before the single write. `PerformanceService.normalizeHealthScores` + `AccountTrigger` is the zero-extra-DML pattern (Phase 4).
- **Avoid `for` loops building strings that never stop**: `String` concatenation in a tight loop is a classic CPU/minute cruncher; prefer `List<String>` joined once.
- **Prefer selective reads to defensive post-filters**: don't `SELECT ALL` then `filter in Apex` — push the predicate into `WHERE` so the platform does the selective work.
- **Use `OFFSET` sparingly**: deep pagination re-reads everything before the offset; iterate on ordered Ids (`WHERE Id > :lastId`) for true scale.

## 8. Asynchronous Housekeeping

Everything "extra" belongs behind the user's click. Scheduled `rebuildHealthScores` (cron `0 0 2 * * ?`) keeps derived data fresh nightly; batch jobs absorb data-feed volume; `Async_Job_Monitor__c` makes the workload observable. As a PDII engineer your instinct is: **compute synchronously only what the user experiences.**

## Hands-On Exercises

### Exercise 1: Query Plan on your filters

1. Open Developer Console → Query Plan and paste `SELECT Id FROM Account WHERE Health_Score__c > 50`.
2. Add `WHERE Name LIKE '%ACME%'` and compare cost/cardinality; switch the wildcard to `ACME%` and observe selectivity improve.
3. Add a **custom index** on `Health_Score__c` (sandbox/scratch) and re-plan — compare before/after cost.

### Exercise 2: Map join demo

1. Insert 5 accounts and 200 contacts across them.
2. Time (or `Limits.getCpuTime()`) the nested-loop variant vs `PerformanceService.slotContactsByAccount` + lookups for each account.
3. Confirm `mapJoinBucketsContactsByAccount` in the test asserts ordinal behaviour (orphans skipped).

### Exercise 3: Batch the millions

1. Insert ~2,500 accounts (loop of list-inserts).
2. `Database.executeBatch(new HealthScoreRecalculator(), 200)` and count `Async_Job_Monitor__c` batches; try scope 2000 and note the transaction count drop.
3. Add `Database.Stateful` totals and print them from `finish`.

### Exercise 4: Index strategy decision

1. Given a report that times out on `Opportunity WHERE StageName = 'Closed Won' AND CloseDate > 2024-01-01`, propose (in prose) whether a compound index, a skinny-table migration, or a Big Object archive is the right frontier — then implement the index in scratch and re-run the query plan.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Governor limit** | Platform-imposed per-transaction caps (SOQL 100, DML rows 10k, heap 6 MB, CPU 10 s...). |
| **Selective query** | Query that reaches data through an index rather than scanning the table. |
| **Query Plan tool** | Developer Console diagnostic showing which indexes/conditions the optimizer uses. |
| **Index** | Under-used secret: standard (Id, Name, OwnerId...), custom, and compound indexes. |
| **Skinny table** | Narrow denormalized copy of a heavy object created for read-heavy selective workloads. |
| **Big Object** (`__b`) | Immutable, index-keyed object for billions of archival/analytics records. |
| **Map join** | Bucketing a child collection by key (O(n+m)) to replace nested loops (O(n*m)). |
| **`Database.QueryLocator`** | Lazy, streaming row source for batch `start()`; exempt from the 50k cap. |
| **`Database.Stateful`** | Class keyword persisting fields between batch chunks. |
| **Batch scope** | Records per `execute` chunk (default 200, max 2000). |
| **Compound/filtered index** | Index across multiple columns enabling previously non-selective predicates. |
| **Precomputation** | Storing expensive derived values (e.g. `Health_Score__c`) instead of recomputing on every read. |

## Certification Checkpoints

- [ ] I can recite the five sync governor numbers exactly (SOQL/DML rows/heap/CPU/callouts).
- [ ] I can explain why `LIKE '%x%'` is non-selective and propose the compound-index fix.
- [ ] I can convert a nested-loop snippet into a Map join and state the complexity change.
- [ ] I know `QueryLocator` avoids the 50k cap and scope ranges 200–2000.
- [ ] I can choose between formulas, lookup queries, and precomputed fields for a read-heavy value.
- [ ] I can distinguish skinny tables, Big Objects, and external objects by scenario.
- [ ] I can plan batch housekeeping (nightly `rebuildHealthScores`) with cron + `Async_Job_Monitor__c`.