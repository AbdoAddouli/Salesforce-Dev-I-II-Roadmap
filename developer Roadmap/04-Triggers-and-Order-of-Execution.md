# Phase 4: Triggers and Order of Execution

Triggers are Apex's hooks into record events. More certification questions are lost to trigger details than to any other single area, because every DML you perform lands in the middle of a precisely ordered sequence of platform automation.

## Learning Objectives

By the end of this phase, you will be able to:
- Name every trigger context variable and use each one in the correct event.
- Choose before vs after triggers for a given business need.
- Write bulkified triggers that never query or DML inside loops.
- Implement a trigger-handler framework with recursion prevention.
- Recite the platform's order of execution and predict what fires (and in what sequence) for any DML.
- Enqueue async work from a trigger without breaking governor limits.

## 1. Trigger Structure and Context Variables

A trigger attaches to one event (or a comma list of events) on one object:

```apex
trigger AccountTrigger on Account (before update) {
    if (TriggerHandlerService.shouldRun('AccountTrigger')) {
        PerformanceService.normalizeHealthScores(Trigger.new);
    }
}
```

Inside any trigger body you get **context variables** describing the in-flight change:

| Variable | Meaning | Useful in |
|----------|---------|-----------|
| `Trigger.new` | `List` of new (in-memory) records | before/after insert and update; empty in delete |
| `Trigger.newMap` | `Map<Id(SObject)>` keyed by new record Id | after insert/update; **null in before insert** |
| `Trigger.old` | `List` of original records | update and delete (and undelete); empty in insert |
| `Trigger.oldMap` | `Map<Id(SObject)>` of original records | after update / delete / undelete |
| `Trigger.isBefore` | true in before events | any trigger body |
| `Trigger.isAfter` | true in after events | any trigger body |
| `Trigger.isInsert` / `isUpdate` / `isDelete` / `isUndelete` | which operation is running | one-trigger-per-event routing |
| `Trigger.isExecuting` | true while this trigger runs | defensive guard in shared service methods |
| `Trigger.operationType` | `System.TriggerOperation.*` enum | switch-style logging (see `TriggerHandlerService`) |
| `Trigger.size` | number of records in `Trigger.new`/`old` | bulk-safety checks |

Rules the exam treats as gospel:

- **`Trigger.newMap` is null in before-insert** (records have no Id yet).
- **`Trigger.old`/`oldMap` are empty in insert** events.
- **Update trigger**: `oldMap` gives you the pre-change values; comparing `Trigger.newMap[i].Field` vs `Trigger.oldMap[i].Field` is the *canonical change-detection* pattern—the `CodeReviewTrigger` does exactly this to broadcast only when `Review_Status__c` or `Approved__c` actually changed.
- In **before delete**, `Trigger.old`/`oldMap` hold the records about to be deleted.
- In **after insert/update**, `Trigger.new` fields can be changed but are *not* saved without an explicit DML.
- Platform-event triggers (Phase 5/11) fire **only in after-insert** context.

## 2. Before vs After: The Decision Rule

**Before triggers** run *before* the record values are validated/saved. Their superpower: **you may modify `Trigger.new` in place and the edit is saved automatically** with the original DML statement—zero extra DML. That is why field normalisation (clamp/normalize defaults), derived values, and integrity fixes belong in before triggers. `PerformanceService.normalizeHealthScores` and `AsyncJobService.initializeMonitors` are exactly this pattern (called by `AccountTrigger` and `AsyncJobMonitorTrigger`).

**After triggers** run after the record is saved but before commit. You see the final saved values including fields the platform computed (formulas, roll-ups referencing *other* objects, system timestamps). Their job: react to a committed change—publish platform events, create related records, enqueue jobs, fire callouts. Any change you make *here* requires another DML statement.

Decision checklist:

| Need | Trigger |
|------|---------|
| Set a default, clamp a value, derive a field | **before** (free! saved with the DML) |
| Publish a platform event | after |
| Create a related record | after |
| Read a system-computed value/formula | after |
| Fire a callout / queue async work | after (before blocks on nothing being saved) |
| Recalculate totals across an object hierarchy | after (use existing saved parent state) |

## 3. Bulkify or Die: No SOQL/DML in Loops

Every trigger must perform identically for **1 record or 10,000 records** (a "bulk trigger"). The three cardinal sins are:

1. A `for` loop containing a SOQL query (100-query governor → instant `LimitException` on a 200-record batch).
2. A `for` loop containing `insert/update/delete` (150 DML statements → same).
3. Single-record assumptions (`Trigger.new[0]`, `.get(0)` without a size check).

The remedies are the **map/group/filter patterns**:

```apex
// BAD: query per record
for (Account acc : Trigger.new) {
    List<Contact> cons = [SELECT Id FROM Contact WHERE AccountId = :acc.Id]; // 200 SOQL!
}

// GOOD: collect the keys once, run ONE query
Set<Id> acctIds = new Set<Id>();
for (Account acc : Trigger.new) acctIds.add(acc.Id);
Map<Id, List<Contact>> byAcct = new Map<Id, List<Contact>>();
for (Contact c : [SELECT Id, AccountId FROM Contact WHERE AccountId IN :acctIds]) {
    if (!byAcct.containsKey(c.AccountId)) byAcct.put(c.AccountId, new List<Contact>());
    byAcct.get(c.AccountId).add(c);
}
```

Same discipline for DML: build one `List` of records, then one statement. `CertificationPrepService.buildStudyPlan` collects 13 `Study_Plan__c` rows and runs a single `insert plans`.

## 4. Trigger-Handler Framework and Recursion Prevention

A trigger body that contains business logic cannot be unit-tested in isolation. The repo's **trigger-light** pattern: triggers delegate to service methods, and a shared `TriggerHandlerService` centralises three cross-cutting concerns:

1. **Dispatch control** — `shouldRun('HandlerName')` gates each handler.
2. **Suppression** — `suppress('AccountTrigger')` around a controlled DML (for example a batch that must mutate the same object the trigger handles) and `restore(...)` afterwards. Used in `IntegrationEventSubscriberTrigger` to stop the publish/subscribe feedback loop.
3. **Recursion guard** — a static `Set<Id>` of records already processed (`processedExternalIds`, `markProcessed`, `hasProcessed`). Because **static variables persist for the whole transaction** (they are reset per transaction, not per trigger invocation), the guard survives any re-entry triggered by further DML. `TriggerHandlerServiceTest` verifies the guard is fresh in each test method.

Recursion in the exam has two flavours:

- **Trigger recursion** — your after-update trigger updates a record, re-firing the after-update trigger. Guard with the static-Id pattern or the suppress/restore registry.
- **Automation recursion** — a workflow/flow field update re-saves the record, re-entering triggers (Order of Execution step below). Static guards also cover this.

**Future methods from triggers**: a trigger can enqueue `@future`, queueable, or batch work (Phase 5) so long-running logic doesn't occupy the synchronous transaction. Constraints: `@future` cannot take sObjects (primitives/collections/List<Id> only), cannot be called from within a future method, and enqueueing does not block the trigger; use after triggers (records already committed) so the async job can query them.

## 5. The Order of Execution (Memorise This)

Every DML flows through the platform's documented **order of execution**. The version below is the exam-accurate sequence; the bolded entries are the ones questions always pivot on.

1. **Load the original record** from the database (or initialize an empty record for an insert/upsert).
2. **Load all record changes from the request and run system validation**: user permission checks, record-type assignment, field-layout integrity, and required-field validation. If anything fails, the operation ends here.
3. **Save the record to the database** (not yet committed).
4. **Execute all before triggers**.
5. **Run most validation rules** (excluding formula-based rules the user can't see referenced fields on). Duplicate rules run here for before-trigger-updated fields.
6. **Execute all after triggers**.
7. **Execute assignment rules** (e.g., lead/opportunity ownership assignment).
8. **Execute auto-response rules** (e.g., case auto-replies).
9. **Execute workflow rules** (field updates, time-based actions are scheduled).
10. **If workflow did field updates, save the record again.** This re-enters steps 3–9 for the changed fields and **re-fires triggers** (steps 4 and 6) for that second save. Keep looping while field updates cascade.
11. **Run before and after triggers for any new records created by workflow rules** (those child records are themselves saved; they are *not* re-evaluated against workflow rules or process builder/flows).
12. **Execute escalation rules** (case escalation timers/actions).
13. **Execute process builder / flow processes that fire on record changes** — record-triggered Flows evaluation, immediately after workflow rules. If a process/flow performs field updates, that's another record save → more trigger runs.
14. **Execute entitlement rules** for cases (entitlement/Service Entitlement evaluation).
15. **Execute roll-up summary field calculations** and **criteria-based sharing rule evaluation** for OWD/sharing scenarios.
16. **Recalculate formula fields** that depended on modified values.
17. **Commit the transaction** only after every step succeeds; a failure anywhere rolls the entire request back.

The myths the exam loves to shatter:

- **Before triggers run before validation** — yes: validation (step 5) sees your before-trigger edits.
- **After triggers run before assignment/auto-response/workflow/flow** — yes; your after-trigger edits are *not* re-validated or re-fired (unless a later step re-saves: workflow field updates, flows).
- **`LIMIT`/`OFFSET` in triggers is not relevant** but the *sequence of re-saves is*: every re-save of the same record re-fires its before/after triggers—a DML storm that recursion guards must absorb.
- **Deletes**: before-delete triggers can't modify records; deleting returns the record to the recycle bin but the order steps still map (with workflow/flow delete-time actions).
- **Undelete** re-fires before/after-undelete triggers and re-evaluates some rules, but not workflow-escalation automatons the same way.

## Hands-On Exercises

### Exercise 1: Before-trigger defaulting

1. Insert a new `Async_Job_Monitor__c` with `Job_Type__c = 'Queueable'` only.
2. Confirm `AsyncJobMonitorTrigger` set `Job_Status__c = 'Queued'` and `Started_At__c` — and confirm *no* second DML was used (edit was saved with the insert).
3. Insert 200 rows in one batch and confirm the trigger handled the whole list (add a `System.debug(Trigger.new.size())` first, run the feed, remove it).

### Exercise 2: Change detection in after-update

1. Study `CodeReviewTrigger`: it compares `Trigger.oldMap[key].Review_Status__c` with the new value.
2. Update one `Code_Review__c` changing `Review_Status__c`, then update it again changing only `Comments__c`.
3. Observe that only the first update makes it past the change guard (debug in `EventPublisherService.publishCodeReviewEvents`).

### Exercise 3: Recursion guard accountability

1. In anonymous Apex, call `TriggerHandlerService.suppress('AccountTrigger');` then `update` an Account; then `restore`.
2. Verify `shouldRun('AccountTrigger')` flips as expected and that `processedExternalIds` behaves transaction-locally.
3. Craft an update that writes `Account.Health_Score__c` in a before-update trigger and confirm no recursion loop occurs (guarded by the framework).

### Exercise 4: Trace the order of execution

1. Build a throwaway after-update trigger on `Opportunity` that inserts an `OpportunityLineItem` (or `Integration_Log__c` row marked "from trigger") for each change.
2. Apply a field update via a Record-Triggered Flow on the same object and note whether your after-trigger row arrived before or after the flow's activity.
3. Check the debug log: order between your trigger, any workflow rule, and the flow step.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Trigger** | Apex code that runs automatically on a record event (before/after insert/update/delete/undelete). |
| **`Trigger.new`** | New records in insert/update; ephemeral in before triggers, committed in after. |
| **`Trigger.oldMap`** | Original records in update/delete/undelete; the basis for change detection. |
| **Before trigger** | Runs pre-save; editing `Trigger.new` saves with the original DML (no extra statement). |
| **After trigger** | Runs post-save; ideal for reactions (publish events, create related records, enqueue). |
| **Bulkify** | Write triggers that handle the whole batch with collections, maps, and one DML per action. |
| **Trigger handler** | Service-class delegation keeping triggers thin and logic unit-testable. |
| **Recursion prevention** | Transaction-local guard (static `Set<Id>` / suppress registry) stopping re-entry loops. |
| **Change detection** | Comparing `Trigger.oldMap` to `Trigger.new` to act only on real value changes. |
| **Order of execution** | The documented 17-step sequence every DML traverses, from load to commit. |
| **`trigger.operationType`** | `System.TriggerOperation` enum exposing which event fired. |

## Certification Checkpoints

- [ ] I can recite the order of execution sequence from "load original" through "commit".
- [ ] I know `Trigger.newMap` is null in before-insert and `Trigger.oldMap` is empty in insert.
- [ ] I can state the single design reason before triggers can modify `Trigger.new` for free.
- [ ] I can write a map-collect-then-query trigger body that never queries inside a loop.
- [ ] I can contrast workflow field-update re-saves vs flow re-saves vs after-trigger edits.
- [ ] I can explain when `@future` is callable from a trigger and what it cannot receive.
- [ ] I can debug a recursion loop using the static guard pattern from `TriggerHandlerService`.
- [ ] I can predict which of two automations (trigger vs flow) wins when both fire on the same DML.