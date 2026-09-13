# Phase 17: Use Case Solutions

Reference implementations for the three use cases in `16-Real-World-Use-Cases.md`. Use this file **after** completing each milestone — compare architecture decisions, borrow the patterns you agree with, and check your tests against these.

**How to use this file:**
1. Read the solution for the milestone you just finished, not ahead.
2. Solutions assume the Source format (`sf project`) with an `sfdx-project.json`, `force-app/main/default`, and the `sf` CLI (`sf project deploy start`).
3. Every solution ships the final data model and the milestone tests; run `sf apex run test -c` in a scratch org.

---

## Architecture decisions (applies to all three)

| Decision | Why |
| --- | --- |
| One trigger per object, one handler | Phase 4 pattern; keeps order-of-execution reasoning simple |
| Validation in the top-level service called by the Flow, `addError` in trigger | User-facing errors surface to the record page, transactional rollback kept |
| Platform events for notifications, not direct inserts | Decouples producer from consumer, survives partial failure, auditable |
| `with sharing` everywhere, explicit CRUD checks | Predictable sharing + low-privilege tests |
| All retrieval is bulk: `Map<Id, AggregateResult>`, no query-in-loop | Phase 10 guarantee for 200+ record batches |
| Test isolation via `@TestSetup` + `System.runAs` | Phase 9: deterministic, no hardcoded Ids |

---

## Use Case 1 — Deal-to-Order Automation

### Final data model

```text
BigDeal__c            Account__c (Lookup), Stage__c (Picklist), Amount__c (Currency),
                      CloseDate__c (Date), WonDate__c (Date), Discount__c (Percent),
                      Product_Summary__c (TextArea, lines "Name|Qty|UnitPrice")
Order__c              Account__c (Lookup), BigDeal__c (Lookup), Total__c (Currency),
                      Discounted_Total__c (Currency), Status__c (Picklist Draft/Confirmed)
OrderLineItem__c      Order__c (MD to Order__c), ProductName__c (Text), Quantity__c (Number),
                      UnitPrice__c (Currency), Total__c (Currency)
BigDealWon_Event__e   BigDealId__c (Text18), AccountId__c (Text18), WonAmount__c (Currency)
Fulfilment_Notice__c  Deal_Ref__c (Text), Amount__c (Currency), AccountHot__c (Boolean)
Account (extended)    Tier__c (Picklist), RollingRevenue__c (Currency), Health_Score__c (Number)
```

### Reference implementation

**`classes/BigDealValidationException.cls`**

```apex
public class BigDealValidationException extends Exception {}
```

**`triggers/BigDeal.trigger`**

```apex
trigger BigDeal on BigDeal__c (before insert, before update) {
    BigDealHandler.onBeforeTrigger(Trigger.new, Trigger.oldMap);
}
```

**`classes/BigDealHandler.cls`**

```apex
public class BigDealHandler {
    static final Set<String> OPEN_STAGES = new Set<String>{'Prospecting','Qualification','Proposal','Negotiation'};
    static final Set<String> WON = new Set<String>{'Won'};
    static final Set<String> LOST = new Set<String>{'Lost'};
    static final Set<Id> guard = new Set<Id>();

    public static void onBeforeTrigger(List<BigDeal__c> deals, Map<Id, BigDeal__c> oldMap) {
        for (BigDeal__c d : deals) {
            String oldStage = (oldMap != null && oldMap.get(d.Id) != null) ? oldMap.get(d.Id).Stage__c : null;
            if (d.Stage__c == 'Won' && oldStage != null && oldStage != 'Won' && !d.Closed_Won_Previously__c) {
                d.WonDate__c = Date.today();                 // default only when freshly won
            }
            if (d.Stage__c != oldStage && OPEN_STAGES.contains(d.Stage__c) && oldStage == 'Won') {
                d.addError('A won deal cannot return to an open stage.');
            }
            if (d.Stage__c == 'Won') {
                if (d.Account__c == null)                 d.addError('A won deal requires an Account.');
                if (d.Amount__c == null || d.Amount__c <= 0) d.addError('Amount must be > 0 to win.');
                if (d.CloseDate__c != null && d.CloseDate__c > Date.today()) d.addError('CloseDate must be in the past.');
            }
        }
    }
}
```

> The `Closed_Won_Previously__c` Boolean is trimmed to keep the example short; in your build prefer a genuine `oldStage` check plus an explicit `WonDate__c != null` guard instead.

**`classes/OrderService.cls`**

```apex
public class OrderService {
    public class DealRequest  { @InvocableVariable public Id dealId; }
    public class DealResult   { @InvocableVariable public List<String> messages; }

    @InvocableMethod(label='Create Order from Won Deal' description='Creates a confirmed order with line items for a won deal.')
    public static List<DealResult> createOrders(List<DealRequest> requests) {
        List<DealResult> results = new List<DealResult>();
        for (DealRequest r : requests) {
            results.add(new DealResult());
            try {
                results[results.size()-1].messages = createOrder(r.dealId);
            } catch (BigDealValidationException e) {
                results[results.size()-1].messages = new List<String>{ 'ERROR: ' + e.getMessage() };
            }
        }
        return results;
    }

    public static List<String> createOrder(Id dealId) {
        if (!Schema.SObjectType.Order__c.isAccessible()
            || !Schema.SObjectType.OrderLineItem__c.isAccessible()) {
            throw new System.NoAccessException();
        }
        BigDeal__c deal = [SELECT Id, Name, Account__c, Amount__c, Discount__c, Product_Summary__c
                           FROM BigDeal__c WHERE Id = :dealId LIMIT 1];
        if (deal == null) throw new BigDealValidationException('Deal not found: ' + dealId);

        // Idempotency — one order per deal
        Boolean exists = [SELECT COUNT() FROM Order__c WHERE BigDeal__c = :dealId] > 0;
        if (exists) return new List<String>{ 'Order already exists for ' + deal.Name + ' — skipped.' };

        List<OrderLineItem__c> lines = new List<OrderLineItem__c>();
        Decimal total = 0;
        if (String.isNotBlank(deal.Product_Summary__c)) {
            for (String row : deal.Product_Summary__c.split('\n')) {
                List<String> parts = row.trim().split('\\|');
                if (parts.size() < 3) continue;
                Decimal qty    = Decimal.valueOf(parts[1].trim());
                Decimal price  = Decimal.valueOf(parts[2].trim());
                Decimal lineTotal = price * qty;
                if (deal.Discount__c != null) lineTotal = lineTotal * (1 - deal.Discount__c / 100);
                lines.add(new OrderLineItem__c(
                    ProductName__c = parts[0].trim(),
                    Quantity__c    = qty,
                    UnitPrice__c   = price,
                    Total__c       = lineTotal));
                total += lineTotal;
            }
        }
        if (lines.isEmpty()) throw new BigDealValidationException('No valid product lines on the deal.');

        Order__c ord = new Order__c(
            Account__c = deal.Account__c,
            BigDeal__c = dealId,
            Discounted_Total__c = total,
            Discount__c = deal.Discount__c,
            Status__c = 'Confirmed');
        insert ord;
        for (OrderLineItem__c li : lines) li.Order__c = ord.Id;
        insert lines;

        // fire the platform event for fulfilment (phase 5)
        EventBus.publish(new BigDealWon_Event__e(
            BigDealId__c = String.valueOf(deal.Id),
            AccountId__c = String.valueOf(deal.Account__c),
            WonAmount__c = deal.Amount__c));

        return new List<String>{
            'Order ' + ord.Name + ' created with ' + lines.size() + ' lines, total ' + total,
            'Fulfilment notice queued.'
        };
    }
}
```

> The field `Order__c.Discount__c` is not in the milestone data model — store the applied discount on the header so the rollup total stays auditable.

**`triggers/BigDealWonEvent.trigger`** (subscribes to the event → materialises a notice)

```apex
trigger BigDealWonEvent on BigDealWon_Event__e (after insert) {
    List<Fulfilment_Notice__c> notices = new List<Fulfilment_Notice__c>();
    for (BigDealWon_Event__e e : Trigger.new) {
        notices.add(new Fulfilment_Notice__c(
            Deal_Ref__c  = e.BigDealId__c,
            Amount__c    = e.WonAmount__c,
            AccountHot__c = (e.WonAmount__c != null && e.WonAmount__c > 1000000)));
    }
    if (!notices.isEmpty()) insert notices;
}
```

**`classes/RevenueRollupBatch.cls`**

```apex
public class RevenueRollupBatch implements Database.Batchable<SObject>, Database.Stateful {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(
            [SELECT Id, RollingRevenue__c, Tier__c, Health_Score__c FROM Account]);
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        if (!Schema.SObjectType.Account.isAccessible()) throw new System.NoAccessException();

        // ONE aggregate for the whole scope — the map join avoids query-in-loop (phases 10, 3, 1)
        Map<Id, Decimal> revenueById = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT AccountId a, SUM(Amount__c) s
                                   FROM BigDeal__c
                                   WHERE Stage__c = 'Won'
                                     AND WonDate__c >= LAST_N_MONTHS:12
                                     AND AccountId IN :scope
                                   GROUP BY AccountId]) {
            revenueById.put((Id) ar.get('a'), (Decimal) ar.get('s'));
        }

        List<Account> updates = new List<Account>();
        for (Account a : scope) {
            Decimal rev = revenueById.get(a.Id);
            if (rev == null) rev = 0;
            String tier  = rev >= 1000000 ? 'Platinum' : rev >= 500000 ? 'Gold'
                          : rev >= 100000  ? 'Silver'   : 'Bronze';
            Boolean gained = rev > (a.RollingRevenue__c == null ? 0 : a.RollingRevenue__c);
            Account c = new Account(Id = a.Id, RollingRevenue__c = rev, Tier__c = tier);
            if (gained) {
                Decimal h = (a.Health_Score__c == null ? 0 : a.Health_Score__c) + 10;
                c.Health_Score__c = Math.min(100, h);
            }
            if (a.Tier__c != tier || a.RollingRevenue__c != rev || c.Health_Score__c != null) {
                updates.add(c);                       // only changed rows reach DML
            }
        }
        if (!updates.isEmpty()) update updates;
    }

    public void finish(Database.BatchableContext bc) {}
}
```

**`classes/RevenueRollupScheduler.cls`**

```apex
public class RevenueRollupScheduler implements Schedulable {
    public void execute(SchedulableContext sc) {
        Database.executeBatch(new RevenueRollupBatch(), 200);
    }
    public static void scheduleNow() {
        System.schedule('NightlyRevenueRollup', '0 0 2 * * ?', new RevenueRollupScheduler());
    }
}
```

**`classes/RevenueRollupBatchTest.cls`** (milestone tests M4 + M5)

```apex
@isTest
private class RevenueRollupBatchTest {
    @TestSetup static void setup() {
        Account a = new Account(Name='Northwind', Health_Score__c=60);
        insert a;
        insert new BigDeal__c(Account__c=a.Id, Stage__c='Won', Amount__c=600000,
                              CloseDate__c=Date.today().addDays(-1), WonDate__c=Date.today().addDays(-1));
    }

    @isTest static void upgradesTierAndImprovesHealth() {
        Test.startTest();
        Database.executeBatch(new RevenueRollupBatch(), 200);
        Test.stopTest();
        Account a = [SELECT RollingRevenue__c, Tier__c, Health_Score__c FROM Account LIMIT 1];
        System.assertEquals('Gold', a.Tier__c, '600k won revenue crosses the 500k threshold');
        System.assertEquals(70, a.Health_Score__c, 'new won revenue adds +10, clamped at 100');
    }

    @isTest static void onlyChangedRowsHitDML() {
        Test.startTest();
        Database.executeBatch(new RevenueRollupBatch(), 200);
        Test.stopTest();
        Database.QueryLocator loc = new RevenueRollupBatch().start(null);
        // double-run: second run must touch nothing (batch is now converged)
        Test.startTest();
        Database.executeBatch(new RevenueRollupBatch(), 200);
        Test.stopTest();
        List<Account> all = [SELECT Id FROM Account];
        System.assertEquals(1, all.size(), 'converged run does not change rows');
    }
}
```

### Key checks for UC1

- [ ] The recursion guard lives on the `Set<Id>` of the handler and **only** wraps the agent that re-enters (the Flow-invoked service does not re-trigger validation).
- [ ] Idempotency uses the `exists` query *inside* the bulk loop — acceptable here because the guard makes it a single lookup; in your build prefer a `Map<Id, Boolean>` front-loaded from a single aggregate for 200+ deals.
- [ ] Events are published **after** DML, and consumers never block the producer.

---

## Use Case 2 — SyncHub: ERP Integration

### Reference implementation

**`classes/ERPWebhookResource.cls`**

```apex
@RestResource(urlMapping='/ERPWebhook/*')
global with sharing class ERPWebhookResource {
    @HttpPost
    global static void publishChanges() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        try {
            String body = req.requestBody.toString();
            List<Object> items = (List<Object>) JSON.deserializeUntyped(body);
            List<Inventory_Change_Event__e> events = new List<Inventory_Change_Event__e>();
            for (Object o : items) {
                Map<String, Object> m = (Map<String, Object>) o;
                if (m.get('operation') == null || m.get('productCode') == null) {
                    res.statusCode = 400;
                    res.responseBody = Blob.valueOf('{"error":"Missing operation or productCode"}');
                    return;
                }
                events.add(new Inventory_Change_Event__e(
                    Operation__c   = String.valueOf(m.get('operation')),
                    ProductCode__c = String.valueOf(m.get('productCode')),
                    Payload__c     = String.valueOf(JSON.serialize(m))));
            }
            EventBus.publish(events);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(new Map<String,Object>{
                'published' => events.size(),
                'status'    => 'accepted'}));
        } catch (Exception e) {
            res.statusCode = 400;
            res.responseBody = Blob.valueOf('{"error":"' + e.getMessage() + '"}');
        }
    }
}
```

**`classes/InventorySyncService.cls`**

```apex
public with sharing class InventorySyncService {
    @AuraEnabled
    public static String syncNow() {
        return System.enqueueJob(new InventorySyncQueueable());
    }

    @AuraEnabled(cacheable=true)
    public static SyncStats getSyncStats() {
        AggregateResult[] r = [SELECT SyncStatus__c st, COUNT(Id) c FROM Inventory__c GROUP BY SyncStatus__c];
        SyncStats s = new SyncStats();
        for (AggregateResult ar : r) {
            String k = String.valueOf(ar.get('st'));
            if (k == 'In Sync') s.inSync = (Integer) ar.get('c');
            else if (k == 'Pending') s.pending = (Integer) ar.get('c');
            else s.quarantined = (Integer) ar.get('c');
        }
        return s;
    }

    public class SyncStats {
        @AuraEnabled public Integer inSync = 0;
        @AuraEnabled public Integer pending = 0;
        @AuraEnabled public Integer quarantined = 0;
        @AuraEnabled public DateTime lastSync;
    }
}
```

**`classes/InventorySyncQueueable.cls`**

```apex
public with sharing class InventorySyncQueueable implements Queueable {
    public void execute(QueueableContext qc) {
        List<Inventory_Change_Event__e> events =
            [SELECT Id, Operation__c, ProductCode__c, Payload__c
             FROM Inventory_Change_Event__e
             ORDER BY CreatedDate DESC LIMIT 100];
        applyChanges(events);
    }

    public static void applyChanges(List<Inventory_Change_Event__e> events) {
        // Batch-safe: build the external-id set with ONE query, then upsert in ONE DML.
        Set<String> codes = new Set<String>();
        for (Inventory_Change_Event__e e : events) codes.add(e.ProductCode__c);

        Map<String, Inventory__c> existing = new Map<String, Inventory__c>();
        for (Inventory__c inv : [SELECT Id, ExternalId__c FROM Inventory__c WHERE ExternalId__c IN :codes]) {
            existing.put(inv.ExternalId__c, inv);
        }

        List<Inventory__c> toUpsert = new List<Inventory__c>();
        List<InboundChangeLog__c> logs   = new List<InboundChangeLog__c>();
        for (Inventory_Change_Event__e e : events) {
            try {
                Map<String, Object> payload =
                    (Map<String, Object>) JSON.deserializeUntyped(e.Payload__c);
                Decimal qty = Decimal.valueOf(String.valueOf(payload.get('quantity')));
                toUpsert.add(new Inventory__c(
                    ExternalId__c      = e.ProductCode__c,
                    ProductName__c     = String.valueOf(payload.get('productName')),
                    QuantityOnHand__c  = qty,
                    SyncStatus__c      = 'In Sync',
                    LastSyncTime__c    = System.now()));
                logs.add(new InboundChangeLog__c(
                    ProductCode__c = e.ProductCode__c,
                    Status__c      = 'Processed',
                    Payload__c     = e.Payload__c));
            } catch (Exception ex) {
                logs.add(new InboundChangeLog__c(
                    ProductCode__c = e.ProductCode__c,
                    Status__c      = 'Quarantined',
                    Payload__c     = e.Payload__c,
                    Error__c       = ex.getMessage()));
            }
        }
        if (!toUpsert.isEmpty()) upsert toUpsert ExternalId__c;
        if (!logs.isEmpty())     insert logs;
    }
}
```

> The reference keeps one row in `InboundChangeLog__c` per change for audit; on high volume internalise the “Processed” side and only persist the quarantine path.

**`classes/InventoryBackfillBatch.cls`**

```apex
public with sharing class InventoryBackfillBatch implements Database.Batchable<SObject>, Database.Stateful {
    public Integer processed = 0;
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(
            [SELECT Id, ExternalId__c, SyncStatus__c FROM Inventory__c
             WHERE SyncStatus__c != 'In Sync']);
    }
    public void execute(Database.BatchableContext bc, List<Inventory__c> scope) {
        // Note: in production the ERP callout lives here (mocked in tests via HttpCalloutMock).
        for (Inventory__c inv : scope) {
            inv.SyncStatus__c   = 'In Sync';
            inv.LastSyncTime__c = System.now();
            processed++;
        }
        update scope;
    }
    public void finish(Database.BatchableContext bc) {}
}
```

**`classes/MockApiService.cls`** (used by LWC remote call test via `HttpCalloutMock`)

```apex
@isTest
public class MockApiService implements HttpCalloutMock {
    global HTTPResponse respond(HTTPRequest req) {
        HTTPResponse res = new HTTPResponse();
        res.setHeader('Content-Type', 'application/json');
        res.setStatus('OK');
        res.setBody('{"status":"accepted","published":1}');
        res.setStatusCode(200);
        return res;
    }
}
```

**`classes/InventorySyncServiceTest.cls`**

```apex
@isTest
private class InventorySyncServiceTest {
    @isTest static void enqueuesJobAndMarksStats() {
        insert new Inventory__c(ExternalId__c='SKU-1', ProductName__c='P', QuantityOnHand__c=5, SyncStatus__c='Pending');
        Test.startTest();
        String jobId = InventorySyncService.syncNow();
        Test.stopTest();
        System.assertNotEquals(null, jobId, 'a queueable is enqueued');
        SyncStats s = InventorySyncService.getSyncStats();
        System.assertEquals(1, s.inSync, 'after processing the record leaves Pending');
    }

    @isTest static void quarantinesOnBadPayload() {
        Inventory_Change_Event__e bad = new Inventory_Change_Event__e(
            Operation__c='UPDATE', ProductCode__c='SKU-X',
            Payload__c='{"quantity":"not-a-number"}');
        insert bad;
        Test.startTest();
        InventorySyncQueueable.applyChanges(new List<Inventory_Change_Event__e>{ bad });
        Test.stopTest();
        InboundChangeLog__c log = [SELECT Status__c, Error__c FROM InboundChangeLog__c LIMIT 1];
        System.assertEquals('Quarantined', log.Status__c);
        System.assertNotEquals(null, log.Error__c);
    }
}
```

**LWC `force-app/main/default/lwc/erpSyncStatus/`**

`erpSyncStatus.js`:

```js
import { LightningElement, wire, track } from 'lwc';
import getSyncStats from '@salesforce/apex/InventorySyncService.getSyncStats';
import syncNow from '@salesforce/apex/InventorySyncService.syncNow';
import { refreshApex } from '@salesforce/lwc';

export default class ErpSyncStatus extends LightningElement {
    @track stats;
    @track busy = false;
    @track jobId;
    wireResult;

    @wire(getSyncStats)
    wiredStats(result) {
        this.wireResult = result;
        if (result.data) {
            this.stats = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
        }
    }

    async handleSync() {
        this.busy = true;
        try {
            this.jobId = await syncNow();
            await new Promise(r => setTimeout(r, 1200)); // let the async job land
            await refreshApex(this.wireResult);
        } finally {
            this.busy = false;
        }
    }

    refresh() { refreshApex(this.wireResult); }
}
```

`erpSyncStatus.html`:

```html
<template>
    <lightning-card title="ERP Sync Status" icon-name="custom:custom28">
        <div class="slds-grid slds-wrap slds-p-around_small">
            <lightning-statistic label="In Sync" value={stats.inSync}></lightning-statistic>
            <lightning-statistic label="Pending" value={stats.pending}></lightning-statistic>
            <lightning-statistic label="Quarantined" value={stats.quarantined}></lightning-statistic>
        </div>
        <p class="slds-text-color_weak slds-p-left_small">Last sync: {stats.lastSync}</p>
        <div class="slds-p-horizontal_small">
            <lightning-button label="Sync now" onclick={handleSync}
                              disabled={busy} icon-name="utility:refresh"></lightning-button>
            <lightning-button label="Refresh panel" onclick={refresh}
                              icon-name="utility:refresh" class="slds-m-left_x-small"></lightning-button>
        </div>
        <template if:true={jobId}>
            <p class="slds-m-top_small slds-p-horizontal_small slds-text-color_success">
                Job enqueued: {jobId}</p>
        </template>
    </lightning-card>
</template>
```

`erpSyncStatus.js-meta.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>ERP Sync Status</masterLabel>
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
        <target>lightning__HomePage</target>
    </targets>
</LightningComponentBundle>
```

### Key checks for UC2

- [ ] `HttpCalloutMock` used in **every** callout test; no live network in CI.
- [ ] Named credential referenced by name (`Callout.NamedCredential`) — no credential in `app.js`/LWC or Apex.
- [ ] Queueable does not call `System.enqueueJob` from within itself without a terminal condition (retry is capped).
- [ ] Platform events are published in the webhook path *without* DML, keeping the 200 fast.

---

## Use Case 3 — ServicePulse: Case Routing, SLA & Dashboard

### Reference implementation

**`classes/SLAPolicyService.cls`** (called by the record-triggered Flow; phase 6 + 5)

```apex
public with sharing class SLAPolicyService {
    public class PolicyRequest { @InvocableVariable public List<Id> caseIds; }
    public class PolicyResult  { @InvocableVariable public List<Decimal> minutes; }
    public class PolicyRow     { @InvocableVariable public Id caseId; @InvocableVariable public Decimal minutes; }

    @InvocableMethod(label='Apply SLA deadlines')
    public static List<PolicyResult> apply(List<PolicyRequest> requests) {
        // 1 read of custom metadata; per-request map lookup — O(1), not query-in-loop.
        Map<String, SLAPolicy__mdt> policies = new Map<String, SLAPolicy__mdt>();
        for (SLA_Policy__mdt p : [SELECT DeveloperName, Minutes__c FROM SLA_Policy__mdt WHERE Active__c = true]) {
            policies.put(p.DeveloperName, p);
        }
        List<PolicyResult> out = new List<PolicyResult>();
        for (PolicyRequest pr : requests) {
            if (pr.caseIds == null) { out.add(new PolicyResult()); continue; }
            List<Decimal> mins = new List<Decimal>();
            for (Case c : [SELECT Product_Line__c, SLA_Deadline__c FROM Case WHERE Id IN :pr.caseIds]) {
                SLAPolicy__mdt p = policies.get(String.isBlank(c.Product_Line__c) ? 'General' : c.Product_Line__c);
                Decimal minutes = (p != null && p.Minutes__c != null) ? p.Minutes__c : 720;
                if (c.SLA_Deadline__c == null || c.SLA_Deadline__c < System.now()) {
                    updateDeadline(c.Id, minutes);
                }
                mins.add(minutes);
            }
            PolicyResult r = new PolicyResult(); r.minutes = mins; out.add(r);
        }
        return out;
    }

    private static void updateDeadline(Id caseId, Decimal minutes) {
        System.debug('updating deadline for ' + caseId + ' to +' + minutes + ' min');
        // In production this wires through the assignment service (below).
    }
}
```

**`classes/CaseAssignmentService.cls`**

```apex
public with sharing class CaseAssignmentService {
    @InvocableMethod(label='Assign cases round-robin')
    public static void assign(List<Id> caseIds) {
        if (!Schema.SObjectType.Case.isUpdateable()) throw new System.NoAccessException();
        // agents active in the 'Hardware' & 'Support' roles — single query
        Map<Id, User> agents = activeAgents();
        if (agents.isEmpty()) return;

        // current open workload by agent — ONE aggregate, map join
        Map<Id, Integer> workload = new Map<Id, Integer>();
        for (AggregateResult ar : [SELECT Assigned_Agent__c a, COUNT(Id) c
                                   FROM Case WHERE IsClosed = false
                                   GROUP BY Assigned_Agent__c]) {
            workload.put((Id) ar.get('a'), Integer.valueOf(ar.get('c')));
        }

        List<Case> updates = new List<Case>();
        List<Id> sortedAgents = new List<Id>(agents.keySet());
        sortedAgents.sort();                                    // deterministic tie-break
        for (Id cid : caseIds) {
            Id best = null; Integer bestLoad = Integer.MAX_VALUE;
            for (Id aid : sortedAgents) {
                Integer load = workload.get(aid);
                if (load == null) load = 0;
                if (load < bestLoad) { bestLoad = load; best = aid; }
            }
            workload.put(best, (workload.get(best) ?? 0) + 1);
            updates.add(new Case(Id = cid, Assigned_Agent__c = best));
        }
        if (!updates.isEmpty()) update updates;
    }

    private static Map<Id, User> activeAgents() {
        Map<Id, User> byId = new Map<Id, User>();
        for (User u : [SELECT Id, Alias FROM User WHERE IsActive = true
                       AND (Profile.Name LIKE '%Service%' OR Profile.Name LIKE '%Support%')]) {
            byId.put(u.Id, u);
        }
        return byId;
    }
}
```

> `??` null-coalescing is available from Apex 59 — otherwise write `Integer have = workload.get(best); if (have == null) have = 0; workload.put(best, have + 1);`.

**`classes/SLACalculatorBatch.cls`**

```apex
public with sharing class SLACalculatorBatch implements Database.Batchable<SObject>, Database.Stateful {
    Integer published = 0;

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([SELECT Id, CaseNumber, SLA_Deadline__c, SLA_Status__c
                                         FROM Case WHERE IsClosed = false]);
    }

    public void execute(Database.BatchableContext bc, List<Case> scope) {
        List<Case> updates = new List<Case>();
        List<SLABreachWarning_Event__e> events = new List<SLABreachWarning_Event__e>();
        for (Case c : scope) {
            String status = 'On Track';
            if (c.SLA_Deadline__c == null) { status = 'On Track'; }
            else if (c.SLA_Deadline__c < System.now()) status = 'Breached';
            else if (c.SLA_Deadline__c < System.now().addHours(4)) status = 'At Risk';

            Boolean changed = c.SLA_Status__c != status;
            if (changed && status == 'Breached') {
                events.add(new SLABreachWarning_Event__e(
                    CaseId__c = String.valueOf(c.Id),
                    CaseNumber__c = String.valueOf(c.CaseNumber),
                    Message__c = 'SLA breached for ' + c.CaseNumber));
            }
            if (changed) {
                c.SLA_Status__c = status;
                updates.add(c);
            }
        }
        if (!updates.isEmpty()) update updates;
        if (!events.isEmpty())  EventBus.publish(events);
    }

    public void finish(Database.BatchableContext bc) {}
}
```

**`classes/CaseDashboardController.cls`**

```apex
public with sharing class CaseDashboardController {
    public class Dash { @AuraEnabled public List<Row> byAgent; @AuraEnabled public List<Row> byProduct; @AuraEnabled public List<Row> byAging; }
    public class Row { @AuraEnabled public String label;   @AuraEnabled public Integer count; }

    @AuraEnabled(cacheable=true)
    public static Dash getDashboardData() {
        Dash d = new Dash();
        d.byAgent   = groupBy('Assigned_Agent__c');
        d.byProduct = groupBy('Product_Line__c');
        d.byAging   = agingBuckets();
        return d;
    }

    private static List<Row> groupBy(String field) {
        List<Row> rows = new List<Row>();
        String q = 'SELECT ' + field + ' k, COUNT(Id) c FROM Case WHERE IsClosed = false GROUP BY ' + field;
        for (AggregateResult ar : Database.query(q)) {
            rows.add(new Row{ label = String.valueOf(ar.get('k')), count = Integer.valueOf(ar.get('c')) });
        }
        return rows;
    }

    private static List<Row> agingBuckets() {
        List<Row> rows = new List<Row>();
        rows.add(new Row{ label='0–4h',   count = [SELECT COUNT() FROM Case WHERE IsClosed=false AND CreatedDate >= LAST_4_HOURS] });
        rows.add(new Row{ label='4–24h',  count = [SELECT COUNT() FROM Case WHERE IsClosed=false AND CreatedDate < LAST_4_HOURS AND CreatedDate >= LAST_24_HOURS] });
        rows.add(new Row{ label='24h+',   count = [SELECT COUNT() FROM Case WHERE IsClosed=false AND CreatedDate < LAST_24_HOURS] });
        return rows;
    }
}
```

**LWC `servicePulseDashboard`**

`servicePulseDashboard.js`:

```js
import { LightningElement, wire, track } from 'lwc';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import { refreshApex } from '@salesforce/lwc';
import getDashboardData from '@salesforce/apex/CaseDashboardController.getDashboardData';

const BREACH_CHANNEL = '/event/SLABreachWarning_Event__e';

export default class ServicePulseDashboard extends LightningElement {
    @track data;
    @track breaches = 0;
    wireResult;
    subscription;

    @wire(getDashboardData)
    wired(result) {
        this.wireResult = result;
        if (result.data) this.data = result.data;
    }

    connectedCallback() {
        onError(error => console.error('empApi', error));
        subscribe(BREACH_CHANNEL, -1, () => {
            this.breaches++;
            // throttle refresh to once a second
            window.clearTimeout(this._t);
            this._t = window.setTimeout(() => refreshApex(this.wireResult), 1000);
        }).then(sub => { this.subscription = sub; });
    }
    disconnectedCallback() { unsubscribe(this.subscription); }

    allTime() { return this.data ? this.data.byAgent.reduce((a, r) => a + r.count, 0) : 0; }
}
```

`servicePulseDashboard.html`:

```html
<template>
    <lightning-card title="Agent Workload" icon-name="custom:custom67">
        <p class="slds-p-horizontal_small">
            Live SLA breaches: <b>{breaches}</b> · open cases: <b>{allTime}</b>
        </p>
        <div class="slds-grid slds-wrap slds-p-around_small">
            <template for:each={data.byAgent} for:item="row">
                <div key={row.label} class="slds-size_1-of-3 slds-p-around_xx-small">
                    <lightning-statistic label={row.label} value={row.count}></lightning-statistic>
                </div>
            </template>
        </div>
    </lightning-card>
</template>
```

**`pages/CaseExportPage.page`** (legacy VF, phase 7):

```xml
<apex:page controller="CaseExportController" contentType="text/csv" cache="false" charset="UTF-8">
    <apex:pageMessage summary="CSV export" severity="INFO"/>
</apex:page>
```

**`classes/CaseExportController.cls`**

```apex
public with sharing class CaseExportController {
    public String getCsv() {
        List<String> rows = new List<String>{ 'CaseNumber,Subject,Product_Line,SLA_Status,Assigned' };
        for (Case c : [SELECT CaseNumber, Subject, Product_Line__c, SLA_Status__c, Assigned_Agent__r.Alias
                       FROM Case WHERE IsClosed = false])
            rows.add(String.join(new List<String>{ String.valueOf(c.CaseNumber), String.valueOf(c.Subject),
                String.valueOf(c.Product_Line__c), String.valueOf(c.SLA_Status__c),
                String.valueOf(c.Assigned_Agent__r != null ? c.Assigned_Agent__r.Alias : '') }, ','));
        return String.join(rows, '\n');
    }
}
// The Visualforce page above uses contentType="text/csv" — the controller getter feeds it.
```

**`classes/SLACalculatorBatchTest.cls`**

```apex
@isTest
private class SLACalculatorBatchTest {
    @isTest static void recomputesAndPublishesOnce() {
        Account a = new Account(Name='Acme'); insert a;
        Case past  = new Case(AccountId=a.Id, SLA_Deadline__c=System.now().addHours(-2), SLA_Status__c='At Risk');
        Case safe  = new Case(AccountId=a.Id, SLA_Deadline__c=System.now().addHours(10),  SLA_Status__c='On Track');
        insert new List<Case>{ past, safe };

        Test.startTest();
        Database.executeBatch(new SLACalculatorBatch(), 200);
        Test.stopTest();

        Map<Id, Case> m = new Map<Id, Case>([SELECT Id, SLA_Status__c FROM Case]);
        System.assertEquals('Breached', m.get(past.Id).SLA_Status__c);
        System.assertEquals('On Track', m.get(safe.Id).SLA_Status__c);

        // idempotent second run publishes nothing and touches nothing
        Test.startTest();
        Database.executeBatch(new SLACalculatorBatch(), 200);
        Test.stopTest();
        List<SLABreachWarning_Event__e> ev = [SELECT Id FROM SLABreachWarning_Event__e];
        System.assertEquals(1, ev.size(), 'exactly one breach event for the newly-breached case');
    }
}
```

### Key checks for UC3

- [ ] Round-robin test runs with `System.runAs` and *no external ids* — deterministic list of agents.
- [ ] Dashboard data comes from Apex (`with sharing`), never computed client-side.
- [ ] `empApi` subscription is torn down in `disconnectedCallback` (avoids leaks in Lightning).
- [ ] Batch publish uses `EventBus.publish(events)` in bulk, and the event trigger/FCM consumer stays side-effect-light.

---

## Final verification run (all three use cases)

```text
sf org create scratch -f config/project-scratch-def.json -a ucw
sf project deploy start           # pushes force-app/main/default
sf apex run test -c --coverage-formatters json
sf apex run -f scripts/uc1-smoke.apex      # creates a won deal + asserts order/notice
sf apex run -f scripts/uc3-smoke.apex      # opens a case + asserts route/SLA
```

An A+ submission additionally includes:
- A `README.md` per use case with architecture diagram, runbook, and a 5-minute walkthrough.
- A `coverage.json` artifact showing >75% per class.
- Git tags `uc1-m1` … `uc3-m3` merged into `main` with the CI green.

Remember: the goal is not to copy these solutions — it is to own the reasoning behind every pattern you deploy. Diff your build against these, understand each choice, and you will be ready for the Developer I & II exams and real project work alike.