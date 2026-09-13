# Phase 5: Async Apex and Platform Events

When a single transaction cannot finish inside governor limits—or should not wait for the user—Apex hands work to the background: which mechanism, with which state, and which limits. Platform events add an asynchronous, decoupled messaging layer on top of the same transaction model.

## Learning Objectives

By the end of this phase, you will be able to:
- Distinguish transactional, `@future`, queueable, schedulable, and batch Apex and pick the right tool.
- Chain and state-carry queueable jobs with `System.enqueueJob`.
- Run a schedulable on a cron expression and a batch over a `QueryLocator` with `Database.executeBatch`.
- Apply `Database.Stateful`, `Database.RaisesPlatformEvents`, and per-batch governance.
- Use `EventBus.publish` in bulk and subscribe via a platform-event trigger.
- Test every async flavour inside `Test.startTest`/`Test.stopTest`.

## 1. The Transaction Framework

Every Apex block runs in a **transaction**: a unit of work that either commits fully or rolls back fully (with a few platform exceptions). Synchronous code—from a trigger, a button, or a REST call—consumes the *sync* governor budget and must finish while the caller waits. Async Apex runs as a **separate transaction** with its own (larger) budget and does not gum up the user's click.

| Capability | Sync to Async difference |
|-----------|--------------------------|
| CPU time | 10 s (lim) → 60 s (async) |
| Heap | 6 MB → 12 MB |
| SOQL | 100 → 200 |
| Callouts | 10 → 10 (but async has more room to breathe around them) |
| DML statements | 150 → 150 |

(The numbers above are the documented governor-range; Phase 10 keeps the full table.)

The key mental model: **async work is deferred by design.** You enqueue it, the current transaction commits, and the platform later runs the job with a fresh transaction and a fresh limit budget. That is exactly why trigger logic that "needs" more time hands off: enqueue, return, done.

## 2. The Async Toolkit: Which One When

### @future methods

```apex
public class AsyncJobService {
    @future
    public static void callOutAsync(String jobName) {
        // still can call @future? NO — a future cannot call another future.
    }
}
```

Simple, fire-and-forget. **Hard constraints**: parameters can only be **primitives, collections of primitives, or `List<Id>`**—never sObjects (their Ids only survive serialization); can't be called *from* another future method; no chaining; no return value. Use queueable instead unless you explicitly need "today only a future fits."

### Queueable Apex

The modern workhorse: a class implementing `Queueable` with state carried in **instance fields** (not static), enqueued via `System.enqueueJob`:

```apex
public class MonitorQueueable implements Queueable {
    private final Id monitorId;
    public MonitorQueueable(Id monitorId) { this.monitorId = monitorId; }

    public void execute(QueueableContext context) {
        // ... do work, then optionally chain:
        System.enqueueJob(new NextQueueable(...));
    }
}
```

```apex
Id jobId = System.enqueueJob(new MonitorQueueable(monitor.Id));
```

Why queueable beats future: it **accepts sObjects** as arguments, can **chain** jobs (enqueue another from `execute`, max 5 in a chain), and `QueueableContext`/the returned `AsyncApexJob` Idets observability. The lab demonstrates the full loop in `AsyncJobService.enqueueMonitor` → `MonitorQueueable`.

### Schedulable Apex

For cron-style schedules. A class implementing `Schedulable` with `execute(SchedulableContext)` gets registered with a six-part cron expression:

```apex
public class AsyncJobService implements Queueable, Schedulable {
    public static Id scheduleDailyHealthRefresh() {
        // cron: second minute hour day-of-month month day-of-week
        return System.schedule('Daily Account Health Refresh', '0 0 2 * * ?', new AsyncJobService());
    }
    public void execute(SchedulableContext sc) {
        AsyncJobService.runHealthScoreBatch(); // hand off heavy work to a batch
    }
}
```

Cron field order to memorise: `second minute hour day-of-month month day-of-week`. Let `?` mean "no specific value" and `*` mean "every". `System.schedule` returns a `Id` you can assert non-null in tests (see `AsyncJobServiceTest.schedulerRegistersACronJob`). A scheduled batch can also invoke `Database.executeBatch(...)` from inside `execute`.

### Batch Apex

The highest-capacity tool. A class implementing `Database.Batchable<sObject>` with three methods:

| Method | Purpose | Returns |
|--------|---------|---------|
| `start(BatchableContext)` | define the data to process | `Database.QueryLocator` (or `Iterable`) |
| `execute(BatchableContext, List<sObject>)` | process one chunk | `void` |
| `finish(BatchableContext)` | post-processing once after all chunks | `void` |

```apex
public class HealthScoreRecalculator implements Database.Batchable<sObject>, Schedulable {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id, Health_Score__c FROM Account');
    }
    public void execute(Database.BatchableContext bc, List<sObject> scope) {
        List<Account> accounts = (List<Account>) scope;
        for (Account acc : accounts) acc.Health_Score__c = AsyncJobService.clampScore(acc.Health_Score__c);
        update accounts;                     // ONE DML per chunk
    }
    public void finish(Database.BatchableContext bc) {
        System.debug('Health score batch finished.');
    }
}
// kick it off
Id batchJobId = Database.executeBatch(new HealthScoreRecalculator(), 200);
```

Batch-specific facts the exam will test:

- **`Database.QueryLocator` has no 50,000-row cap**—it streams; batch over *millions* of records is safe. `Iterable` scope (custom collections) has a 50 k cap per scope batch.
- **Default scope size is 200**; you may pass up to **2000** as the second argument. Bigger scopes = fewer transactions but higher per-batch limits pressure.
- `Database.Stateful` on the class keeps a member variable *across* chunks (without it, instance state resets per chunk). Use it for running totals.
- `Database.RaisesPlatformEvents` class keyword (or `Database.releasePlatformEvents` calls) lets batch/queueable/schedulable/future **publish platform events to subscribers**.
- `AsyncApexJob` in `BatchableContext.getJobId()` and `finish()` `Database.getQueryLocator` results are viewable via the `Async_Job_Monitor__c` rows the lab writes.
- Timeouts/CPU apply *per batch transaction*: each `execute` chunk is its own transaction with its own 60 s CPU.

**Selection matrix:**

| Shape of work | Tool |
|---------------|------|
| One-off small job, sObject state needed | Queueable |
| Recurring nightly/weekly job | Schedulable (+ enqueue batch) |
| Millions of rows, chunked | Batch (QueryLocator) |
| Old-school fire-and-forget callout you can't refactor | `@future` |

## 3. Testing Async Code: startTest / stopTest

Async jobs do not run synchronously when you call them in a test—so tests wrap the *trigger point* in `Test.startTest()` and force completion with `Test.stopTest()`:

```apex
@isTest
static void queueableCompletesInsideStartTestStopTest() {
    Test.startTest();
    Id jobId = AsyncJobService.enqueueMonitor(monitor);
    Test.stopTest();                       // forces the queueable to finish NOW
    // now assert the outcome
    Async_Job_Monitor__c completed = [SELECT Job_Status__c FROM Async_Job_Monitor__c LIMIT 1];
    System.assertEquals('Completed', completed.Job_Status__c);
}
```

`Test.stopTest()` also forces **scheduled** jobs to run once and **batch** to process all chunks. Without the start/stop pair, the assertions run before the async work. Governor limits get a fresh budget inside the start/stop window too.

## 4. Platform Events: Publish and Subscribe

**Platform events** (custom objects ending `__e`) are messages on Salesforce's event bus. They decouple the publisher from the subscriber: the publisher does not wait, know, or care who handles the event.

Two volume tiers:

| | Low-volume | High-volume |
|---|-----------|-------------|
| Delivery | synchronous to subscribers | asynchronous delivery |
| Publish from Apex | `EventBus.publish(...)` | `EventBus.publish(...)` |
| Retention for replay | ~24 h | ~72 h |
| Best for | fast in-org reactions | heavy external streaming |

### Publishing

```apex
Integration_Event__e evt = new Integration_Event__e(
    Source_Object__c = 'Integration_Log__c',
    Direction__c = 'Outbound',
    Integration_Type__c = 'REST API',
    Status__c = 'Success',
    Endpoint__c = 'https://api.example.com/v1/hello',
    Correlation_Id__c = 'ABC-123',
    Payload__c = '{"msg":"hi"}'
);
List<Database.SaveResult> results = EventBus.publish(new List<Integration_Event__e>{ evt });
```

Exam-critical publish rules (all reflected in `EventPublisherService.publishIntegrationEvents`):

- **One `EventBus.publish(list)` call for many events** — publish calls count against the **DML-statement governor**, so looping `EventBus.publish` per event is a LimitException ticket.
- `EventBus.publish` returns one `Database.SaveResult` per event; inspect `.isSuccess()` and `getErrors()`. Events can fail (quota exceeded, field errors).
- You **cannot query `SELECT ... FROM X__e`** to see published events in your own transaction; subscribers materialise the payload (the lab's subscriber trigger writes `Integration_Log__c` rows).
- A failed `EventBus.publish` in an *all-or-nothing* flow can roll the whole transaction back; use partial-success discipline around it.

### Subscribing

Two idioms:

1. **Apex trigger** on the event object (`IntegrationEventSubscriberTrigger on Integration_Event__e (after insert)`) — record-triggered, runs asynchronously from the publisher's perspective.
2. **Flow / platform-event flow** on the event object — declarative subscribers.

The subscriber trigger maps payload fields into outcome records. In the lab it writes `Integration_Log__c`, guarded with `TriggerHandlerService.suppress('IntegrationLogTrigger')` to stop the *log → event → log* feedback loop:

```apex
trigger IntegrationEventSubscriberTrigger on Integration_Event__e (after insert) {
    if (!TriggerHandlerService.shouldRun('IntegrationEventSubscriberTrigger')) return;
    List<Integration_Log__c> logs = new List<Integration_Log__c>();
    for (Integration_Event__e evt : Trigger.new) {
        logs.add(new Integration_Log__c(
            Direction__c = evt.Direction__c ?: 'Inbound',
            Integration_Type__c = evt.Integration_Type__c,
            Status__c = evt.Status__c ?: 'Success',
            Endpoint__c = evt.Endpoint__c,
            Correlation_Id__c = evt.Correlation_Id__c,
            Payload__c = evt.Payload__c
        ));
    }
    TriggerHandlerService.suppress('IntegrationLogTrigger');
    insert logs;
    TriggerHandlerService.restore('IntegrationLogTrigger');
}
```

Rule of thumb for the exam: **a platform-event trigger fires in after-insert context, does not re-enter the regular before/after validation chain, and can cause infinite loops if it re-publishes the same event type** — guard, guard, guard.

### Replays and Resiliency

Platform events carry a **ReplayId** you can subscribe to from CometD/streaming clients; retaining it lets a subscriber pick up missed events after a disconnect. The retention window (24 h low-volume, 72 h high-volume) plus `ReplayId` is the "durable but not infinite" story the PDII exam expects. In Apex, the com.suname to remember is `EventBus.publish` (write) + a trigger or flow (read) inside the same org; external systems use CometD with replay.

## 5. Observability: The Async_Job_Monitor Pattern

The repo's `Async_Job_Monitor__c` object and `AsyncJobMonitorTrigger` make background work *visible*: each job writes `Job_Status__c` (Queued → Running → Completed/Failed), `Started_At__c`/`Finished_At__c`, `Related_Object__c`, and an `Error_Message__c`. Batch/queueable/schedulable all funnel through the same logging surface—so the dashboard can chart, report, and alert on every async run. Always prefer "emit a record, let a trigger or subscriber react" over scattering raw `System.debug` in production flows.

## Hands-On Exercises

### Exercise 1: Queueable lifecycle

1. From anonymous Apex, call `AsyncJobService.enqueueMonitor(new Async_Job_Monitor__c(Job_Type__c='Queueable', Related_Object__c='Account'))`.
2. Wait a moment, then `SELECT Job_Status__c, Related_Object__c FROM Async_Job_Monitor__c ORDER BY CreatedDate DESC LIMIT 5`.
3. Change `MonitorQueueable.execute` to throw an exception, re-run, and observe `Job_Status__c='Failed'` and the error message surface in `Error_Message__c`.

### Exercise 2: Batch over a QueryLocator

1. Ensure >200 Accounts exist, then `Database.executeBatch(new AsyncJobService.HealthScoreRecalculator(), 200)`.
2. Track batches in `Async_Job_Monitor__c`; run once with scope 200 and once with 2000 and compare `Total_Batches__c`/counts.
3. Add a `Database.Stateful` counter to `HealthScoreRecalculator` and assert the grand total in `finish`.

### Exercise 3: Schedulable cron validation

1. Call `AsyncJobService.scheduleDailyHealthRefresh()`; capture the returned job Id.
2. Verify the schedule appears under Setup → Scheduled Jobs, then delete the cron Job with `System.abortJob(jobId)`.
3. Test an invalid cron (`'0 0 2'`) and confirm the thrown error from `System.schedule`.

### Exercise 4: Platform event round trip with a subscriber

1. `EventBus.publish(new Integration_Event__e(...))` a single event with a unique `Correlation_Id__c`.
2. Query `Integration_Log__c` for that correlation and confirm the subscriber trigger materialised the row.
3. Publish 100 events in ONE `EventBus.publish` call and confirm one log row per accepted event.
4. Redistribute as a flow subscriber (remove the trigger, add an after-save platform-event flow) and repeat—note the difference in delivery timing.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Transaction** | A DML unit that commits or rolls back as a whole, with its own governor budget. |
| **`@future`** | Annotation for simple async methods; primitives/List<Id> params only; no chaining. |
| **Queueable** | Async class with instance-field state; sObject args; chaining via `System.enqueueJob`. |
| **Schedulable** | Async class driven by a six-part cron; registered via `System.schedule`. |
| **Batch Apex** | `Database.Batchable` with start/execute/finish; `QueryLocator` streams millions of records. |
| **`Database.Stateful`** | Class keyword persisting instance fields across batch chunks. |
| **`Database.RaisesPlatformEvents`** | Class keyword allowing async jobs to publish platform events. |
| **`QueryLocator`** | Lazy row iterator from `start()`; exempt from the 50 k cap; scope defaults to 200. |
| **`EventBus.publish(list)`** | The bulk publish call; returns `Database.SaveResult[]`; counts as DML statements. |
| **Platform event `__e`** | Custom base object for event-bus messages. |
| **ReplayId** | Per-event durable ID enabling catch-up subscriptions after disconnects. |
| **`Test.startTest/stopTest`** | Test-only pair; forces pending async jobs to complete before assertions. |

## Certification Checkpoints

- [ ] I can map each workload shape to future/queueable/schedulable/batch.
- [ ] I know `@future` cannot accept sObjects and cannot be invoked from another future.
- [ ] I can write a `Database.Batchable` with `QueryLocator`, scope 200, and `Database.Stateful`.
- [ ] I can recite the sync→async limit upgrades (CPU 10→60 s, heap 6→12 MB, SOQL 100→200).
- [ ] I can explain why `EventBus.publish` must take a List and what the SaveResults tell me.
- [ ] I can design a subscriber trigger that cannot recursively re-publish.
- [ ] I can test a queued/scheduled/batched job with `Test.startTest`/`Test.stopTest`.
- [ ] I know the retention-window difference between low- and high-volume events.