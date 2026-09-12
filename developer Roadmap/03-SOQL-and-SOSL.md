# Phase 3: SOQL and SOSL

The two query languages are the bread and butter of every Apex developer. SOQL reads structured rows with filters, sorting, and aggregates; SOSL performs token-based text search across many objects at once. This phase is dense because the exam asks scores of SOQL detail questions.

## Learning Objectives

By the end of this phase, you will be able to:
- Write well-formed SELECT queries: fields, `FROM`, `WHERE`, `ORDER BY`, `LIMIT`, and `OFFSET`.
- Filter with comparison operators, `IN`, `LIKE`, and multi-select picklist `INCLUDES`/`EXCLUDES`.
- Run aggregate queries with `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP BY`, and `HAVING`, and read results by alias.
- Traverse parent relationships with dot notation and child relationships with subqueries.
- Handle polymorphic lookups (including `TYPEOF`) and cross-object filtering.
- Build dynamic SOQL safely with bind variables and `String.escapeSingleQuotes()`.
- Choose SOSL vs SOQL and parse SOSL's nested `List<List<SObject>>` output.

## 1. The SELECT Statement

SOQL clauses in order:

```
SELECT <field list>
FROM <object>
[WHERE <conditions>]
[WITH <security mode>]                  -- e.g. WITH USER_MODE, WITH SECURITY_ENFORCED
[GROUP BY <fields>]
[HAVING <condition>]                     -- applies to grouped rows
[ORDER BY <field> <ASC|DESC> <NULLS FIRST|LAST>]
[LIMIT n]
[OFFSET n]
```

Field list options beyond plain field names:

```apex
SELECT Id, Name, COUNT(Id)                               -- aggregate
FROM Opportunity
GROUP BY Name
```

```apex
SELECT Id, Name, Account.Name                            -- parent relationship
FROM Opportunity
```

```apex
SELECT Id, Name, (SELECT Id, Name FROM Opportunities)    -- child subquery
FROM Account
```

Newer curated field-list functions exist: `FIELDS(STANDARD)`, `FIELDS(CUSTOM)`, `FIELDS(ALL)` (from API 50+), plus `COUNT()` and `count()` aggregate. The exam treats these as optional conveniences; expect the older explicit syntax.

**There is no `SELECT *`.** You must list fields. If a listed field is not accessible to the running user (FLS), the query itself throws in `user mode`; in the default **system mode**, the field is silently dropped from results? No—in system mode an inaccessible field returns null; with `WITH SECURITY_ENFORCED` it throws. This is the seam where CRUD/FLS matters.

## 2. WHERE Clauses and Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=`, `!=`, `<>` | equality / inequality | `StageName = 'Closed Won'` |
| `<`, `<=`, `>`, `>=` | ordering | `Deal_Quality_Score__c >= 60` |
| `IN`, `NOT IN` | membership (list or subquery) | `Id IN :accountIds` |
| `LIKE`, `NOT LIKE` | wildcard match: `%` any run, `_` one char | `Name LIKE 'Acme%'` |
| `INCLUDES`, `EXCLUDES` | multi-select picklist membership | `Interests__c INCLUDES ('Apex','SOQL')` |
| `AND`, `OR` with grouping `()` | compound logic | `(A = 1 AND B = 2) OR C = 3` |
| `= null` / `!= null` | IS NULL semantics; **not `IS NULL`** | `Health_Score__c = null` |
| `EXISTS` / `NOT EXISTS` | correlation with a subquery | `EXISTS (SELECT Id FROM Opportunities)` |
| `IN :(subquery)` | value subquery | `OwnerId IN (SELECT Id FROM User WHERE IsActive = true)` |

Key exam specifics:

- SOQL **has no `IS NULL`**—it's `= null` (and `!= null`).
- `LIKE` wildcards: `%` = any string, `_` = exactly one character. Escaping a literal `%` uses `\\%` inside an escaped string if you must.
- Date literals can be typed directly: `CloseDate > 2025-01-01` or use date literals like `TODAY`, `YESTERDAY`, `LAST_N_DAYS:30`, `THIS_MONTH`, `NEXT_FISCAL_QUARTER`.
- **Bind variables** (`:identifier`) are your friend: they are type-safe, injection-proof, and allow `IN :list`. Only a `:` variable can be `null` and mean "no filter" (then the clause must still be syntactically valid). Literal concatenation of user input is prohibited if you want to stay exam- and security-clean (Phase 3 dynamic SOQL section below).
- `!=` does **not** match records where the field is null; nulls are excluded from inequality comparisons. Count them explicitly with `= null` if you want them.

## 3. ORDER BY, LIMIT, OFFSET

```apex
SELECT Id, Name FROM Account
ORDER BY Health_Score__c DESC NULLS LAST, Name ASC
LIMIT 10 OFFSET 5
```

- `NULLS FIRST|LAST` controls null placement (default is platform-defined; be explicit on the exam).
- `LIMIT` is mandatory for practical result caps, and you can bind it: `LIMIT :limitRows`.
- `OFFSET` allows pagination but the query planner still scans rows to reach the offset—**pay attention**: for large tables, prefer cursor/splitting via bounded `WHERE` (e.g. iterate on the last Id) rather than huge offsets, a Phase 10 concern.
- Sorting by a custom field that isn't indexed can degrade to a sort of the full filtered set—fine at small scale, not fine at millions of rows.

## 4. Aggregation: COUNT, SUM, AVG, GROUP BY, HAVING

An **aggregate query** returns one row per group, delivered as `List<AggregateResult>` where each `AggregateResult` is an *untyped* access-by-alias object:

```apex
List<AggregateResult> rows = [
    SELECT AccountId, COUNT(Id) contactCount, AVG(Health_Score__c) avgHealth
    FROM Contact
    WHERE AccountId != null
    GROUP BY AccountId
    ORDER BY COUNT(Id) DESC
    LIMIT 10
];

for (AggregateResult row : rows) {
    Integer count = (Integer) row.get('contactCount');
    Decimal avgHealth = (Decimal) row.get('avgHealth');
    Object accountId = row.get('AccountId');
}
```

Rules that show up verbatim:

- **You can never read an aggregate value by its source field name**—only by the alias you gave it (`contactCount`), or by the un-aliased function text (`COUNT(Id)`) if you didn't alias. `row.get('AccountId')` works for grouped keys.
- `COUNT()` (with no expression) returns the count of all rows and its alias default; `COUNT(Id)` counts rows where `Id` is non-null—identical for most objects but exam-relevant because `COUNT(Field)` ignores nulls. `COUNT_DISTINCT(Field)` counts distinct values.
- `SUM`, `AVG`, `MIN`, `MAX` ignore nulls.
- **Aggregate queries return at most 50,000 rows** from grouped results; big grouping needs extra care (Phase 10).
- `HAVING` filters *grouped* rows (like `WHERE` filters detail rows): `HAVING COUNT(Id) > 5`, `HAVING AVG(Deal_Quality_Score__c) >= 60`.
- If the query has no `GROUP BY` but uses an aggregate, the result is a single row (or zero) — the classic "which row did I get?" trap.
- Apex casting: `COUNT` returns an `Integer` (via `get` it surfaces as an `Integer`), `SUM`/`AVG` come back as `Decimal` (so cast accordingly), and null aggregates surface as `null`—guard before casting.

The repo demonstrates all of this in `SoqlSoslService.countContactsByAccount()` and `dealQualityByStage()`, with assertions on alias access in `SoqlSoslServiceTest.cls`.

## 5. Relationship Queries: Parent (dot) and Child (subquery)

**Parent lookup via dot notation** — one cheap statement instead of two:

```apex
List<Opportunity> opps = [
    SELECT Id, Name, Account.Name, Account.Industry
    FROM Opportunity
    WHERE Id = :oppId
];
System.debug(opps[0].Account.Name);
```

- Dot paths traverse lookup or master-detail fields: `Oppty.Account.Name`, `Case.Account.Owner.Name`.
- You may filter on relationships with `WHERE Account.Industry = 'Technology'`, and mix filters across levels — that's **cross-object querying**.
- Parent fields read via dot do **not** require a second SOQL and do **not** count toward the 100-query limit.

**Child subquery** — nested SELECT inside parentheses:

```apex
List<Account> accounts = [
    SELECT Id, Name,
           (SELECT Id, FirstName, LastName FROM Contacts WHERE IsDeleted = false)
    FROM Account
    WHERE Id IN :accountIds
];
for (Account acc : accounts) {
    for (Contact c : acc.Contacts) {  // relationship name, pluralised
        // ...
    }
}
```

- The relationship name is usually the pluralised object name downgraded: `Contacts`, `Opportunities`, `Cases`.
- The child list arrives on the parent record as `List<SObject>`; children are NOT separate query limit consumers but each child row counts toward the **50,000 record** transaction limit.
- **When you query children on many parents, the platform returns only the first 200 child records per parent.** A classic trap: a subquery returning "only 200" when 400 children exist.
- Subqueries may appear inside the `WHERE` of a parent query for correlated existence: `WHERE EXISTS (SELECT Id FROM Opportunities WHERE IsClosed = false)`.

## 6. Polymorphic Lookups and TYPEOF

Some lookup fields can reference *multiple objects*: `WhoId` (to `Contact` or `Lead`) and `WhatId` (to `Account`, `Opportunity`, `Campaign`, and most activable objects) are the canonical polymorphic fields on event/task; a custom `Lookup(Account, Contact)`-style field is also polymorphic if it allows more than one object.

Consequences the exam tests:

- You **cannot** query `Who.Name` directly if `Who` can be a `Contact` or `Lead`—`Name` exists on both, though, so `Who.Name` is actually allowed when the field exists across all referenced types; but fields unique to one type (`Who.SomeLeadField`) fail. The guard is **`TYPEOF`**:

```apex
SELECT Id, WhoId,
       TYPEOF Who
         WHEN Contact THEN FirstName, LastName, Email
         WHEN Lead THEN Company, Status
         ELSE Name
       END
FROM Event
```

- FLS is enforced per referenced object; a user who can see `Contact` but not `Lead` will get null/negated values for the hidden branch. Sharing is enforced per polymorphic record — this is a PDII favourite.

## 7. Dynamic SOQL

Dynamic SOQL builds the query as a `String` at runtime and runs it with `Database.query(...)`:

```apex
String query = 'SELECT Id, Name, Health_Score__c FROM Account WHERE ' + condition + ' LIMIT 5';
List<Account> accounts = Database.query(query);
```

**The exam's favourite comparative pair:** *bind variables vs concatenation*.

- **Bind** (`:var`) is compile-time parameter substitution, immune to injection, and keeps literals typed. Almost every safe SOQL in the repo binds: `WHERE Id IN :accountIds`, `WHERE Health_Score__c >= :minScore`, `ORDER BY * :limitRows`.
- **Concatenation** of user input invites **SOQL injection** (`' OR 1=1--`). If you must build dynamic text (dynamic field names, dynamic objects, dynamic `FIND`), escape apostrophes with `String.escapeSingleQuotes(userInput)` *before* embedding:

```apex
String safeCondition = String.escapeSingleQuotes(condition);   // see SoqlSoslService.runSafeDynamicQuery
String query = 'SELECT Id, Name, Health_Score__c FROM Account WHERE ' + safeCondition + ' LIMIT 5';
return Database.query(query);
```

Exam points: `Database.query` returns `List<SObject>` (cast needed); dynamic SOQL fails at *runtime*, not compile time, so wrap in `try`; you cannot dynamically bind arbitrary identifiers—only literal values—so object/field names must come from a safe allow-list or describe-driven validation, not raw input.

## 8. SOSL: Searching Many Objects at Once

**SOSL** (Salesforce Object Search Language) tokenizes your text and searches fields across multiple standard/custom objects in one call. Structure:

```
FIND 'query terms' [IN <SEARCH GROUP|FIELD>]
RETURNING <Object>(FIELDS…), <Object>(FIELDS…)
[WITH <dataCategory|division|user/system mode>]
[LIMIT n]
```

The repo's example:

```apex
List<List<SObject>> results = [
    FIND :term IN ALL FIELDS
    RETURNING Account(Id, Name), Contact(Id, FirstName, LastName)
];
// results[0] = Account matches, results[1] = Contact matches
```

`SEARCH GROUPS`: `ALL FIELDS`, `NAME FIELDS`, `EMAIL FIELDS`, `PHONE FIELDS`, `SIDEBAR FIELDS`. `IN :term` is the bind-safe form.

Everything that matters on the exam:

- SOSL returns **`List<List<SObject>>`**—one inner list per object in `RETURNING`, **in the order you listed them**. `results[0]` is the first object's hits. `results.get(index).isEmpty()` tells you nothing matched that object.
- Default `LIMIT` is **200 records per searched object** unless you set `LIMIT n` (then n applies per object? — no: SOSL LIMIT caps the total across the whole search; each object returns up to that limit? The docs: for SOSL, LIMIT specifies the maximum number of records to return *per object searched*, and the default is 200). Get this right: the documented meaning is records are capped per object searched by `LIMIT`.
- SOSL performs **tokenized, fuzzy-ish word matching**; it is ideal for "search a name across Account, Contact, Lead, Opportunity". SOQL is for exact structural queries with filters and sorting.
- SOSL **cannot** aggregate, `ORDER BY`, or slice with `OFFSET`. Use SOQL when you need precise filtering, sorting, grouping, or parent-child traversal.
- SOSL respects **search indexes** and is not allowed on all field types (e.g., not on long text/encrypted fields per config).
- **Test determinism**: real search indexes aren't guaranteed in tests; use `Test.setFixedSearchResults(List<List<SObject>>)` (as `SoqlSoslServiceTest` does) to feed known results to your SOSL code under test.

Decision heuristic: start with SOQL for everything structured; reach for SOSL when the user types a term against many objects at once and relevance beats exactness.

## 9. SOQL Edge Cases the Exam Recycles

| Edge case | Correct behaviour |
|-----------|-------------------|
| `WHERE StageName != 'Closed'` | Excludes rows where `StageName` is `null` — nulls are never matched by `!=`. |
| Field name vs alias in `ORDER BY` | `ORDER BY COUNT(Id) DESC` is legal; `ORDER BY contactCount` is not (alias is not a column). |
| `LIMIT` in a subquery | Allowed inside child subqueries; the inner `LIMIT` applies per parent row set. |
| Case-sensitivity | Object/field names are case-insensitive; literal *values* in `WHERE` are case-sensitive unless you use `LIKE` semantics. |
| Bind with `IN :emptyList` | `Id IN :emptySet` returns no rows, which is the *desired* empty behaviour — not a syntax error. |
| `GROUP BY` with nulls | Null keys form their own group, returning a row where the grouped field is null. |
| Date filtering without a cast | `WHERE CloseDate < 2025-01-01` works; `WHERE CloseDate < 01/01/2025` is a literal parse error. |
| Queries in loops | Never. Any snippet with `[SELECT ...]` inside a `for` is automatically wrong on the exam. |

The final row is a genuine giveaway: exam questions *always* include at least one SOQL-in-a-loop variant as a distractor. If you spot the loop-written query, you've found the wrong answer regardless of what the loop computes.

## 10. Querying for the Quiz Use Case

The repo's `SoqlSoslService` and its test class are designed so each query illustrates exactly one syntax family you should be able to **reproduce from memory**: aggregates by alias, relationship dot-paths, child subqueries with a bound `IN :set`, SOSL returning `List<List<SObject>>`, and dynamic SOQL with `escapeSingleQuotes`. Before sitting the exam, mentally trace each method — if you can *say* what each returns and why, Sections 1–9 are yours.

## Hands-On Exercises

### Exercise 1: Aggregates by alias

1. From the scratch org, run `SoqlSoslService.countContactsByAccount()` and print `row.get('contactCount')` per row.
2. Add a `HAVING COUNT(Id) > 1` variant and re-run.
3. Note what `(Object)` casting you must perform for `AVG` vs `COUNT`.

### Exercise 2: Parent-child batch traversal

1. Pick 10 Accounts and run `SELECT Id, Name, (SELECT Id, Name FROM Opportunities WHERE IsClosed = false) FROM Account WHERE Id IN :ids`.
2. Count total child records across all parents and compare with `50,000`; probe the "first 200 children per parent" cap by inserting 205 opportunities for one account and re-querying.

### Exercise 3: Dynamic SOQL vs injection

1. Call `SoqlSoslService.runSafeDynamicQuery("Name LIKE '%TechCorp%'")` and confirm escaping works.
2. Deliberately try `Name = 'x' OR 1=1--` against the un-escaped concatenation variant and observe the behaviour difference (never ship the unescaped variant).
3. Wrap a `Database.query` call with an invalid object name in `try/catch (QueryException e)` and print `e.getMessage()`.

### Exercise 4: SOSL across objects

1. Create one Account "Northwind Traders" and one Contact "North Windlass" in your scratch org.
2. Search `FIND 'North' IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, FirstName)`, and print `results[0]` and `results[1]` sizes.
3. Swap to `IN NAME FIELDS` and observe how fewer fields become searchable.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **SOQL** | Salesforce Object Query Language; structured SELECT-style reads with filters/aggregates/relationships. |
| **SOSL** | Salesforce Object Search Language; tokenized full-text search across multiple objects. |
| **Bind variable** | `:var` syntax; injects a value safely and is subject to type coercion, never concatenated. |
| **AggregateResult** | Row type returned by `GROUP BY` queries; values read **by alias** via `.get('alias')`. |
| **`COUNT()` vs `COUNT(field)`** | `COUNT()`/`COUNT(Id)` count rows; `COUNT(field)` counts only non-null field values. |
| **Relationship query** | Query that follows parent lookups (dot) or children (subquery) in one statement. |
| **Subquery** | Parenthesised `SELECT` that fetches child rows per parent (max 200 per parent). |
| **Polymorphic lookup** | A lookup field that can reference more than one object type (WhoId, WhatId, custom). |
| **`TYPEOF`** | SOQL construct selecting different fields per referenced object in a polymorphic lookup. |
| **`WITH SECURITY_ENFORCED`** | Enforces FLS/CRUD during a query instead of silently stripping or returning null. |
| **`String.escapeSingleQuotes()`** | Escapes apostrophes in user input before embedding in dynamic SOQL; the injection guard. |
| **`List<List<SObject>>`** | SOSL return shape: one inner list per object in `RETURNING`, in declaration order. |

## Certification Checkpoints

- [ ] I can write a grouped aggregate query and read results only via aliases.
- [ ] I know that child subqueries cap at 200 children per parent.
- [ ] I can contrast `= null` with `IS NULL`, `LIKE '%'`, and `INCLUDES` semantics.
- [ ] I can explain bind-variable safety vs concatenation and quote `escapeSingleQuotes`.
- [ ] I can parse a SOSL result `List<List<SObject>>` in the correct object order.
- [ ] I know SOSL's per-search default limit and which features it lacks (aggregates, ORDER BY).
- [ ] I can demonstrate a `TYPEOF` query and its polymorphic FLS consequences.