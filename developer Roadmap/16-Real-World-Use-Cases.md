# Phase 16: Real-World Use Cases

This phase is the capstone of the entire roadmap. You take on **three real-world use cases**, each one a complete build that makes you apply **every** skill you acquired in Phases 1–13: developer fundamentals, Apex, SOQL/SOSL, triggers and order of execution, async Apex and platform events, automation with Flows, UI in Visualforce/Aura/LWC, testing, performance with large data volumes, integration and enterprise patterns, and release/CI-CD tooling.

You will see which phase each skill comes from in the per-use-case skill map. There are no step-by-step recipes here — only business requirements, milestones, hints, and a list of acceptance criteria. The detailed reference solutions are in `17-Use-Case-Solutions.md`.

**How to use this file:**
1. Work through all 31 exercises and mini projects in Phase 14 before starting this phase.
2. Build each use case in its own scratch org or Dev Hub-created sandbox.
3. Do the use cases in order: UC1, UC2, UC3. They get progressively more complex.
4. Commit to git after every milestone and push to a branch. Phase 12 skills are part of the deliverable.
5. Attempt each milestone yourself. Open `17-Use-Case-Solutions.md` only after you have a working, tested build — or when you are stuck on one milestone for more than a couple of hours.
6. Keep `sf apex run test -c` green: every use case must ship with a passing test class covering at least 75% of the org.

---

## What “Applying Everything” Looks Like

Each use case maps the roadmap phases to concrete deliverables. A quick reference of the mastery checklist that applies to all three:

| Roadmap phase | Skill you must demonstrate | Where it shows up |
| --- | --- | --- |
| 1 – Developer Fundamentals | Apex collections, DML, sharing context, custom exceptions, Debug | Every service class and handler |
| 2 – Apex Language Essentials | Maps, sets, bulk-safe loops, O(1) lookups, no query-in-loop | All batch/queueable/chained code |
| 3 – SOQL & SOSL | Parent-child subqueries, aggregates, dynamic SOQL, injected-parameter safety | Data retrieval, dashboards, search |
| 4 – Triggers & Execution Order | Single-handler triggers, recursion guards, Trigger.old/new usage | `BigDealTrigger`, `InventoryChangeTrigger` |
| 5 – Async Apex & Events | Queueable, Batch, Scheduled, `@future`, Platform Events | Sync jobs, rollups, live dashboards |
| 6 – Automation | Record-triggered Flow, Flow orchestrating Apex via `@InvocableMethod` | Deal-to-order, case routing |
| 7 – UI Foundations | Visualforce controller/page (legacy) | CSV export, legacy screens |
| 8 – Lightning Web Components | LWC `@wire`, imperative `@AuraEnabled`, `refreshApex`, `empApi` | Dashboards, sync status panels |
| 9 – Testing & Debugging | `@TestSetup`, `runAs`, `HttpCalloutMock`, `Test.getQueueableJobs`, assertion quality | Every test class |
| 10 – Performance & LTV | QueryLocator, batch scope, avoiding ballooned SOQL/DML in loops | Backfill batch, rollup batch |
| 11 – Integration | Named Credentials, callouts, `@RestResource`, event-driven patterns, error quarantine | ERP sync, webhook endpoint |
| 12 – Release Management | `sf` CLI, scratch orgs, package.xml, CI/CD via GitHub Actions | Project scaffolding, delivery |
| 13 – Certification Prep | Reading requirements, design trade-offs, explaining decisions | Every “Milestone” write-up |

---

## Use Case 1 — Deal-to-Order Automation (Sales Operations)

### Business context

**Northwind B&O** sells industrial boilers. Their sales team tracks large opportunities on a custom object called `BigDeal__c`. Every time a deal reaches the **Won** stage, the back office must generate a sales `Order__c` with line items, apply a negotiated discount, upgrade the Account tier based on rolling 12-month revenue, and notify the fulfilment team.

Today this is done manually in spreadsheets. Your job is to automate the entire flow with a trigger-driven Apex service, called from a record-triggered Flow, supported by a scheduled rollup batch.

### Business requirements

1. When a `BigDeal__c` record is updated to stage **Won**, validate the record: it must have an Account, an Amount greater than 0, and a close date in the past.
2. If validation fails, block the transaction and show a clear, user-facing error — do not silently lose the data.
3. On success, create one `Order__c` header plus one `OrderLineItem__c` row for each winning product; the order `Total__c` must equal the sum of line totals after any negotiated `Discount__c`.
4. Only one active order may exist per won deal. Re-won deals must not duplicate orders.
5. The Account gets a `Tier__c` upgrade when its rolling 12-month won revenue crosses thresholds ($100k → Silver, $500k → Gold, $1M → Platinum) and its `Health_Score__c` improves by 10 points on new won revenue.
6. Send a `BigDealWon_Event__e` platform event with the deal, amount, and Account id so fulfilment and finance can subscribe.
7. Every night at 2:00 AM a scheduled batch recomputes Account rolling revenue and health, so mixed DML scenarios never leave stale numbers.
8. Back-office users with the `Fulfilment` permission set can edit `Order__c` and its line items; the rest of the org must not be able to.

### Data model you must create

| Object | Fields | Type |
| --- | --- | --- |
| `BigDeal__c` (custom) | `Account__c`, `Stage__c` (Prospecting / Qualification / Proposal / Negotiation / Won / Lost), `Amount__c`, `CloseDate__c`, `WonDate__c`, `Discount__c`, `Product_Summary__c` (textarea) | Lookup, Picklist, Currency, Date, Date, Percent, TextArea |
| `Order__c` (custom) | `Account__c`, `BigDeal__c`, `Total__c`, `Status__c` (Draft / Confirmed), `Discounted_Total__c` | Lookup, Lookup, Currency, Picklist, Currency |
| `OrderLineItem__c` (custom) | `Order__c` (master-detail), `ProductName__c`, `Quantity__c`, `UnitPrice__c`, `Total__c` | MD, Text, Number, Currency, Currency |
| `BigDealWon_Event__e` (platform event) | `BigDealId__c`, `AccountId__c`, `WonAmount__c` | Text(18), Text(18), Currency |
| `Account` (extend) | `Tier__c` (Bronze / Silver / Gold / Platinum), `RollingRevenue__c`, `Health_Score__c` | Picklist, Currency, Number |

> Platform events are **not** shared like normal data — once a `BigDealWon_Event__e` is published it is not subject to object-level sharing. Keep PII out of the event payload.

### What you will apply

| Skill | Phase | Where you use it |
| --- | --- | --- |
| Trigger pattern + recursion guard | 4 | `BigDealTrigger` → one handler class, `Trigger.oldMap` for stage change detection |
| Order of execution | 4 | Flow fires `@InvocableMethod` service **after** the DML; trigger re-entry must be guarded |
| SOQL aggregates & parent-child | 3 | Rolling 12-month revenue query, order total verification |
| Bulk-safe collections | 1–2 | `Map<Id, BigDeal__c>`, `Set<Id>`, no query-in-loop when processing 200 deals |
| Custom exceptions | 2 | `BigDealValidationException` distinguishing validation from system errors |
| Flow + `@InvocableMethod` | 6 | Record-triggered Flow wraps the service and surfaces the result to the user |
| Platform events | 5 | `BigDealWon_Event__e` published and consumed by an event-triggered flow/Apex |
| Scheduled + Batch Apex | 5, 10 | `RevenueRollupBatch` using `QueryLocator` + `Database.schedule` |
| Sharing & permissions | 1 | `with sharing` service class, Fulfilment permission set, CRUD checks |
| Testing | 9 | `@TestSetup`, `runAs`, avoid hardcoded IDs, cover failure path with `Database.insert(list, false)` |
| Release tooling | 12 | `sf project deploy start` per milestone, git commits, CI runs the tests |

### Milestones

Each milestone has a deliverable and acceptance criteria. Commit and push after each one.

**M1 — Validate & default the Big Deal**
- Write a `BigDealTrigger` (one trigger, one handler `BigDealHandler.cls`).
- On *before insert/update*: default `WonDate__c` when `Stage__c` becomes Won, and reject stage changes from Won back to an open stage.
- Block Won records that are missing an Account, have `Amount__c <= 0`, or have a future `CloseDate__c`.
- Acceptance: anonymous Apex inserting an invalid deal shows a friendly error; a valid deal updates defaults correctly; a recursion guard prevents double-`addError`.

**M2 — Deal-to-order service**
- Create `OrderService.cls` (`with sharing`) with `@InvocableMethod` parameters `DealRequest` / `DealResult` inner classes, plus a `createOrder(Id dealId)` method callable from Apex.
- Create the `Order__c` + line items in a single DML statement each, using the `Product_Summary__c` to parse product lines (one per line, format `ProductName|Quantity|UnitPrice`).
- Allow `Discount__c` to reduce each line total; verify `Order__c.Total__c` equals the sum of line `Total__c`.
- Idempotency: if an `Order__c` for this `BigDeal__c` already exists, skip creation and return a message.
- Acceptance: a won deal produces exactly one Order with N correct line items and correct discounted totals; re-running produces no duplicates.

**M3 — Record-triggered Flow + event**
- Build Flow **Deal to Order** (record-triggered, on create or update with `{!$Record.Stage__c} = "Won"`).
- The Flow calls the `@InvocableMethod`, stores the returned messages, and shows them to the user; validation failures surface as Flow errors so the DML rolls back.
- From the service, publish a `BigDealWon_Event__e` on success.
- Create a *platform event* consumer: an event-triggered Flow (or `BigDealWonEventTrigger`) that inserts a `Fulfilment_Notice__c` custom object record (Name = Account name, `Deal_Ref__c`, `Amount__c`).
- Acceptance: saving a Won deal creates the order **and** the fulfilment notice asynchronously; no notice is created on validation failure.

**M4 — Account tier & rollup batch**
- Create `RevenueRollupBatch.cls` (implements `Database.Batchable<SObject>`) using `QueryLocator` over Accounts.
- In `execute`, compute rolling 12-month revenue per Account with a single aggregate SOQL (`GROUP BY AccountId`) and a `Map<Id, AggregateResult>` join — no nested query-in-loop.
- Apply the tier ladder (100k/500k/1M) and add 10 points to `Health_Score__c` for Accounts gaining new won revenue.
- Create `RevenueRollupScheduler.cls` (`System.schedulable`) running the batch nightly.
- Acceptance: `Database.executeBatch` raises Silver → Gold correctly; `System.schedule` produces a running batch on the intended cron; CPU/DML limits stay far from the ceiling for 50+ Accounts.

**M5 — Sharing & security**
- Add the platform event (API name `BigDealWon_Event__e`) and `Order__c`/`OrderLineItem__c` to a `Fulfilment` permission set (read/edit/delete on orders, read-only on Accounts).
- Mark your service classes `with sharing`, add `Schema.SObjectType.*.isAccessible()` checks before SOQL, and throw `System.NoAccessException` on deny.
- Acceptance: as a **Standard User** with the permission set you can edit orders but not win deals; `System.runAs` tests assert the sharing behavior.

**Success criteria checklist** (all must pass to call UC1 done):
- [ ] M1 errors and defaults verified in anonymous Apex
- [ ] M2 exactly one order created per won deal, idempotent on re-run
- [ ] M3 Flow + `@InvocableMethod` works end to end and the event consumer fires
- [ ] M4 rollup/tier batch correct and scheduled nightly
- [ ] M5 Fulfilment permission set enforces the CRUD/sharing matrix
- [ ] `sf apex run test -c` — 75%+ coverage, 0 failures
- [ ] Git history shows a commit per milestone, tagged `uc1-m1` … `uc1-m5`

**Stretch goals:** add a `DiscountClass__c` custom setting so discounts can be edited without a deploy; add a Visualforce “Order preview” page generated server-side for paper approval; wrap the create in an `AllOrNoneHandler` utility that reverts partial DML.

---

## Use Case 2 — SyncHub: ERP Integration with Event-Driven Sync

### Business context

**SyncHub** is a manufacturer that keeps inventory in a legacy ERP (`https://erp.example.com/api`). Orders, stock movements and product master changes are stored there, and Salesforce needs a near-real-time mirror on `Inventory__c`. The ERP team will call a public webhook on every change; you also need a one-time backfill of roughly 1 million existing inventory records, an on-demand “Sync now” button in the UI, and a quarantine for any record the ERP rejects.

### Business requirements

1. Expose an inbound webhook `@RestResource` at `/ERPWebhook` that accepts a JSON payload of one or more stock changes (`operation`, `productCode`, `quantity`, `timestamp`).
2. Each inbound change becomes an `Inventory_Change_Event__e` platform event published by the webhook — the webhook must return `200 OK` fast and never be blocked by Salesforce governor limits.
3. An asynchronous consumer (Queueable) applies event payloads to `Inventory__c`: `upsert` by `ExternalId__c`. Every successful upsert sets `SyncStatus__c = In Sync`, `LastSyncTime__c = now`.
4. Failed records (missing product, ERP dedupe conflict) go to `InboundChangeLog__c` with status **Quarantined** and the error text; nothing is thrown away.
5. An on-screen LWC panel shows counts: In Sync / Pending / Quarantined, plus the last sync time and a **Sync now** button that enqueues the Queueable job on demand.
6. A `SyncQueueBatch` refreshes the initial backfill in chunks, respecting governors, with a limited batch scope, and marks each batch’s status.
7. Deployment must go through the `sf` CLI with a named credential so no secrets live in source code; the CI pipeline (GitHub Actions) must deploy and run tests in a scratch org on every push.

### Data model you must create

| Object | Fields | Type |
| --- | --- | --- |
| `Inventory__c` (custom) | `ExternalId__c`, `ProductName__c`, `QuantityOnHand__c`, `SyncStatus__c` (In Sync / Pending / Quarantined), `LastSyncTime__c` | Text (unique), Text, Number, Picklist, DateTime |
| `Inventory_Change_Event__e` (platform event) | `Operation__c`, `ProductCode__c`, `Payload__c` | Text, Text, Text(255) |
| `InboundChangeLog__c` (custom) | `ProductCode__c`, `Status__c` (Quarantined / Processed), `Payload__c`, `Error__c` | Text, Picklist, TextArea, TextArea |

### What you will apply

| Skill | Phase | Where you use it |
| --- | --- | --- |
| Named Credentials + auth | 11 | `ERP_Credential`, no hardcoded password/token in code |
| HTTP callouts + JSON | 11 | `Http`, `HttpRequest`, `JSONParser` inside the queueable |
| Queueable + chaining | 5 | `InventorySyncQueueable` with `System.enqueueJob`, optional retry-chain on fixed failures |
| Platform events | 5 | Webhook publishes; queueable subscribes via trigger-driven creation (defer with `Test.getQueueableJobs`) |
| Batch Apex + QueryLocator | 10 | Backfill in scopes of 200, batch audits per chunk |
| Dynamic SOQL/DML safety | 3 | `upsert` by external id; `String.escapeSingleQuotes` on any user-supplied filter |
| Custom exceptions + logging | 2 | `SyncException` + quarantine records instead of swallowing errors |
| HTTP mocking in tests | 9 | `HttpCalloutMock` with success and 500 responses; assert retry + quarantine |
| LWC + `@AuraEnabled` | 8 | `erpSyncStatus` component: `@wire` stats, imperative enqueue, `refreshApex` |
| Release + CI/CD | 12 | Named cred via `sf org open`/metadata, workflow that deploys + tests |

### Milestones

**M1 — Webhook endpoint + event**
- Create `ERPWebhookResource.cls` `@RestResource(urlMapping='/ERPWebhook/*')` with `@HttpPost` that reads `RestContext.request.requestBody`, parses JSON into a list of changes, and publishes one `Inventory_Change_Event__e` per change.
- Validation: reject payloads with a non-object `body` or missing `operation`; return HTTP 400 with a JSON error body.
- Modifies nothing in the database directly — only events.
- Acceptance: a `System.HttpCalloutMock` POST (or Developer Console REST test) returns 200 and publishes N events; malformed input returns 400.

**M2 — Queueable consumer + quarantine**
- Create `InventorySyncService.cls`:
  - `@AuraEnabled public static String syncNow()` — enqueues `InventorySyncQueueable` with a `Map<String, Inventory_Change_Event__e>` from the 100 most recent events, returns the job id.
  - `insertFromEvent(Inventory_Change_Event__e ev)` — upserts `Inventory__c` by `ExternalId__c`.
  - `applyChanges(List<Inventory_Change_Event__e>)` — loops bulk-safely with a `Map<Id, ...>` and performs **and records** results.
- Failure paths are captured by `SyncException` → `InboundChangeLog__c` insert with `Status__c = Quarantined`.
- Acceptance: 200 events produce 200 upserts + accurate quarantine; limits do not exceed budget.

**M3 — Backfill batch + scheduled run**
- Create `InventoryBackfillBatch.cls` (`Database.Batchable<SObject>`) over `Inventory__c` records where `SyncStatus__c != In Sync`, scope 200.
- Each batch chunk upserts against the ERP (mocked in tests), sets `SyncStatus__c`, and publishes a failed-batch log if the chunk had errors.
- Acceptance: executing the batch over 1,000 seeded rows completes within limits and marks every row, with a chunk log per failed batch.

**M4 — LWC status panel**
- Create LWC `erpSyncStatus`:
  - `@wire(getSyncStats)` → counts by `SyncStatus__c` and latest `LastSyncTime__c`.
  - “Sync now” button → imperative `syncNow()` then `refreshApex`.
  - Display: three stat chips (In Sync / Pending / Quarantined), last sync time, and a spinning state while the job runs.
- Acceptance: after new events the panel updates in ≤ a few seconds; the button enqueues and reflects the new counts.

**M5 — CI/CD pipeline**
- Structure source under `force-app/main/default`; commit the named-credential-free code only.
- Add a GitHub Actions workflow that creates a scratch org, deploys, runs tests, and destroys the org.
- Acceptance: a pushed commit triggers a passing CI run; no secrets appear in the repo (validate with `git log -p`).

**Success criteria checklist:**
- [ ] M1 webhook accepts valid JSON and publishes events; malformed returns 400
- [ ] M2 queueable upserts + quarantines failures, limits respected
- [ ] M3 backfill handles 1M-scale chunked data within governors
- [ ] M4 LWC panel reflects stats, sync button works, `empApi`/refreshApex live
- [ ] M5 CI runs deploy + tests on every push
- [ ] 75%+ coverage; `HttpCalloutMock` used; no HTTP callouts slip into certain paths

**Stretch goals:** implement retry chaining (re-enqueue up to 3 times with exponential backoff); add a `SyncAudit__c` object storing per-chunk metadata; add a RaceCondition test proving two concurrent enqueues don’t double-apply.

---

## Use Case 3 — ServicePulse: Case Routing, SLA & Agent Dashboard

### Business context

**ServicePulse** runs a 24/7 support department. Cases arrive with a menu-driven `Product_Line__c` and priority. The business wants: (1) automatic routing to the right agent (round-robin by team), (2) an SLA deadline computed from priority, (3) a live LWC dashboard for team leads showing open cases by agent, aging, and SLA health, and (4) a legacy Visualforce CSV export for the Friday report.

### Business requirements

1. Record-triggered Flow **Case Routing** runs on Case create and update: computes `Product_Line__c`, sets `Priority`, looks up the SLA target minutes from a custom metadata type `SLA_Policy__mdt` (per product line), and calls an `@InvocableMethod` service for round-robin agent assignment.
2. The service assigns the agent with the fewest currently-open cases in that product line (documented, testable round-robin, not a formula guess) and writes `Assigned_Agent__c`.
3. `SLA_Deadline__c` = now + policy minutes; a nightly `SLACalculatorBatch` recomputes `SLA_Status__c` (On Track / At Risk / Breached) for open cases and publishes `SLABreachWarning_Event__e` once per newly-breached case.
4. The LWC dashboard aggregates open cases by agent, by product line, and by aging bucket (0–4h, 4–24h, 24h+), refreshes from an `@AuraEnabled(cacheable=true)` controller, and live-refreshes via `empApi` when a breach event fires.
5. A Visualforce page `CaseExportPage` + `CaseExportController` exports the current filtered case list to CSV (legacy pattern kept for the ops team).
6. All bulk operations respect governor limits; dashboards don’t show unshared data (sharing-aware queries; run with a non-admin user in tests).

### Data model you must create

| Object | Fields | Type |
| --- | --- | --- |
| `Case` (extend) | `Product_Line__c`, `SLA_Deadline__c`, `SLA_Status__c` (On Track / At Risk / Breached), `Assigned_Agent__c` | Picklist, DateTime, Picklist, User lookup |
| `SLA_Policy__mdt` (custom metadata) | `Minutes__c`, `Active__c` | Number, Checkbox |
| `SLABreachWarning_Event__e` (platform event) | `CaseId__c`, `CaseNumber__c`, `Message__c` | Text(18), Text(10)?, Text(255) |

### What you will apply

| Skill | Phase | Where you use it |
| --- | --- | --- |
| Record-triggered Flow | 6 | Case budget, routing, delegation to service |
| `@InvocableMethod` from Flow | 6 | Round-robin assignment, deadline computation |
| Batch + Scheduled Apex | 5, 10 | SLA recompute nightly, aging stats, no query-in-loop |
| Platform events | 5 | Breach warnings pushed to `empApi` subscribers |
| LWC `@wire` + `refreshApex` | 8 | Dashboard with reactive filters |
| LWC `empApi` (real-time) | 8 | Live breach counter without polling |
| Aggregates + GROUP BY ROLLUP | 3 | Dashboard counts, no client-side counting |
| Visualforce + controller | 7 | CSV export for ops |
| Sharing + CRUD | 1 | Dashboard respects role-based sharing (`with sharing`), accessed in tests via `runAs` |
| Testing + mocking | 9 | `Test.getQueueableJobs`, assert breaches/events, batch finalize |

### Milestones

**M1 — Case routing flow + policy**
- Create `SLA_Policy__mdt` records (e.g., Billing 480 min, Hardware 120, Software 240, General 720).
- Build the record-triggered Flow: on create/update with `IsClosed = false`, run `{!$Record.CaseNumber} != null`; set priority from a decision table; compute `SLA_Deadline__c` using `@InvocableMethod` `applySlaPolicy(caseIds)`.
- Avoid recursion: the service writes only when values changed.
- Acceptance: opening a case sets product line, priority, deadline from metadata; re-entry is guarded; empty policy falls back to 720 minutes.

**M2 — Round-robin assignment service**
- Create `CaseAssignmentService.cls` with `@InvocableMethod` `assign(caseIds)`.
- Query open-case counts by `Assigned_Agent__c` (single aggregate), pick the minimum, write `Assigned_Agent__c` only if it changed and the agent is active.
- Use a stable tie-break (e.g., lowest `Alias`) so results are deterministic in tests.
- Acceptance: 5 incoming hardware cases distribute across exactly the 2 active hardware agents; counts never exceed a floor of 3 without a third agent.

**M3 — SLA batch + breach events**
- Create `SLACalculatorBatch.cls` + `SLACalculatorScheduler.cls` nightly.
- In `execute`: compute per-case `SLA_Status__c` from `SLA_Deadline__c`, updating only changed rows (avoid DML on unchanged rows), and for rows just turning Breached publish `SLABreachWarning_Event__e` (via an ordered collect → publish once per case).
- Acceptance: 10 open cases recompute to 3 On Track / 4 At Risk / 3 Breached with only the 3 new breach events published; re-run publishes 0 events and touches 0 rows.

**M4 — LWC dashboard + live updates**
- Create LWC `servicePulseDashboard`:
  - `@wire(getDashboardData)` returns `{ byAgent, byProductLine, byAging }` from aggregate SOQL (`GROUP BY ROLLUP` optional; simple `GROUP BY` acceptable if clearly documented).
  - Live section: `empApi` subscription to `SLABreachWarning_Event__e` increments a flash counter and calls `refreshApex` (throttled to once/second).
  - Filters: product line chips that re-query with a parameterized Apex method (bind variables).
- Acceptance: dashboard renders counts, reacts to a breach event without a page reload, and respects sharing under `runAs`.

**M5 — Visualforce CSV export**
- Create `CaseExportController` (extends `Visualforce` controller or extension) with a `getCsv()` action (content type `text/csv`, filename `cases.csv`) returning the same sharing-aware filtered list used by contemporary code.
- Acceptance: the export downloads with correct headers and non-empty row for every visible case; the page run as a low-privilege user shows only shared rows.

**Success criteria checklist:**
- [ ] M1 routing + SLA deadline from custom metadata verified in Flow debug runs
- [ ] M2 deterministic round-robin assignment with a passing unit test
- [ ] M3 nightly batch computes statuses and fires breach events exactly once
- [ ] M4 LWC dashboard aggregates + live `empApi` updates
- [ ] M5 CSV export works with sharing constraints intact
- [ ] 75%+ coverage; every batch/queueable path tested; no query-in-loop anywhere

**Stretch goals:** auto-escalate At-Risk cases via a time-based Flow; add a priority-weighted round-robin (2 points per high-priority case); render the dashboard on a Community page with `with sharing` still enforced.

---

## Final Acceptance

Before you consider this phase complete:

1. All three use cases pass their success criteria checklists above.
2. Every use case folder has its own git branch, tagged milestones, and a CI run that is green.
3. One shared README per use case explaining architecture decisions, the data model, and how to deploy (`sf project deploy start` + `sf org open`).
4. Your org holds 75%+ test coverage with zero failures and zero skipped tests that matter.
5. You can explain in 5 minutes why you made each non-obvious design choice (recursion guard, platform event vs direct DML, cacheable wire vs imperative, sharing decoration).

Completed work is verified in `17-Use-Case-Solutions.md`, which contains the full reference implementations, the final data model, and the milestone tests.