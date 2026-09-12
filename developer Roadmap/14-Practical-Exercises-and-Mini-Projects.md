# Phase 14: Practical Exercises and Mini Projects

This phase is the hands-on laboratory for every concept in the roadmap. Each section maps to the corresponding theory phase. Exercises are graded ★ (beginner) to ★★★ (advanced). Mini projects combine multiple phases into a single buildable feature.

**How to use this file:**
1. Complete all ★ exercises before attempting ★★ or ★★★.
2. Mini projects assume you have completed all exercises in preceding phases.
3. Check your work against `15-Answers-and-Results.md` after each exercise.
4. Run `sf apex run test -c` after every code change to keep coverage green.

---

## Section 1: Developer Fundamentals & Apex Basics (Phases 1–2)

### Exercise 1.1 — SOQL Parent-Child Query ★

**Objective:** Query the core Sales Cloud data model with relationship traversal.

**Instructions:**
1. Create a scratch org and deploy source.
2. Write an anonymous Apex script that:
   - Creates 3 Accounts with `Health_Score__c` values of 50, 75, and 90.
   - Creates 2 Contacts for the first Account, 1 for the second, and 0 for the third.
3. Write a single SOQL query that returns every Account with its child Contacts using a subquery.
4. Write a second SOQL query that returns every Contact with its parent `Account.Name` using dot notation.
5. `System.debug` the results and count the total contacts across all accounts.

**Verify:** You used exactly 2 SOQL statements. No queries inside loops.

---

### Exercise 1.2 — DML Round Trip with Limits Tracking ★

**Objective:** Master insert, update, upsert, delete, and undelete while tracking governor usage.

**Instructions:**
1. In anonymous Apex, build a `List<Account>` with 5 records and insert them in ONE statement.
2. Read them back with one SOQL. Print `Limits.getDmlStatements()` and `Limits.getLimitDMLStatements()`.
3. Modify 3 of the 5 records' `Health_Score__c` and update in ONE statement.
4. `upsert` all 5 using their standard Id.
5. Delete 2 records. Then `undelete` one of them.
6. Query deleted records: `SELECT Id, Name FROM Account WHERE IsDeleted = true ALL ROWS`.
7. Print final DML statement count and total records processed.

**Verify:** Total DML statements used ≤ 5 (insert + query + update + delete + undelete + ALL ROWS query).

---

### Exercise 1.3 — Collections: List, Set, Map ★★

**Objective:** Use all three collection types with sObjects and demonstrate the Map constructor pattern.

**Instructions:**
1. Insert 10 Accounts in one DML statement.
2. Build a `Set<Id>` of all Account Ids from the query results.
3. Build a `Map<Id, Account>` using the `new Map<Id, Account>([SELECT ...])` constructor.
4. Iterate over `accountsById.keySet()` and print each Account's `Name`.
5. Demonstrate `containsKey` with a valid Id and a bogus Id.
6. Convert the map to `List<Account>` via `accountsById.values()` and verify the size.
7. Print the CPU time before and after using `Limits.getCpuTime()`.

**Verify:** You never access a record by index after building the map. All lookups use `.get(id)`.

---

### Exercise 1.4 — Sharing Model Smoke Test ★★

**Objective:** Observe the difference between `with sharing` and `without sharing`.

**Instructions:**
1. Create two classes:
   - `public with sharing class SharingTestA` with `public static Integer countAccounts()` returning `[SELECT COUNT() FROM Account]`.
   - `public without sharing class SharingTestB` with the same method.
2. From anonymous Apex, run both as admin and print the results — both return the same count.
3. Write a test class `SharingModelTest` that:
   - Creates a low-privilege `Standard User` profile user in `@TestSetup`.
   - Uses `System.runAs(lowPriv)` to call both classes.
   - Asserts that `SharingTestA.countAccounts()` returns fewer rows than `SharingTestB.countAccounts()`.

**Verify:** The test passes and demonstrates the sharing difference.

---

### Exercise 1.5 — Partial vs All-or-Nothing DML ★★

**Objective:** Contrast `Database.insert(list, false)` with `insert list` on mixed-validity data.

**Instructions:**
1. Build a list containing 3 valid `Account` records and 1 record with a `Name` longer than 255 characters.
2. Run `Database.insert(records, false)` and loop the `SaveResult[]` to print `isSuccess()` and `getErrors()` for each record.
3. Count successes and failures.
4. Now try `insert records` (all-or-nothing) inside a `try/catch` and observe the `DmlException` behavior.
5. Assert that the all-or-nothing approach saved 0 records, while the partial approach saved 3.

**Verify:** You can explain why partial DML saved records despite one failure.

---

### Exercise 1.6 — Custom Exception and Error Handling ★★

**Objective:** Create and use a custom exception class.

**Instructions:**
1. Create `AccountValidationException extends Exception`.
2. Write a method `validateAccount(Account a)` that throws `AccountValidationException` if `Name` is blank or `Health_Score__c` is outside 0–100.
3. Call `validateAccount` from anonymous Apex in a `try/catch` block for: a blank-name account, a score of 150, and a valid account.
4. Print the exception message for invalid inputs and "Valid" for the valid one.

**Verify:** Custom exception is caught separately from generic `Exception`.

---

### Mini Project 1: Account Health Management Service ★★★

**Objective:** Build a service class that manages Account health scores with full DML, collections, and exception handling.

**Requirements:**
1. Create `AccountHealthService.cls` with `with sharing`.
2. Implement these methods:
   - `public static List<Account> getAccountsByMinScore(Integer minScore)` — query accounts above a threshold.
   - `public static Map<Id, Account> buildAccountMap(List<Id> accountIds)` — returns a Map for O(1) lookups.
   - `public static void normalizeScores(List<Account> accounts)` — clamps `Health_Score__c` to 0–100, sets null to 70.
   - `public static void bulkUpdateScores(Map<Id, Integer> scoreUpdates)` — applies score updates in one DML.
   - `public static Integer calculateAverageScore(List<Account> accounts)` — returns the average (handle empty list).
3. Create `AccountHealthServiceTest.cls` with:
   - `@TestSetup` creating 10 accounts with varied scores.
   - Test methods for each service method.
   - Assertions on collection sizes, DML counts, and edge cases (empty list, null scores).

**Success criteria:** `sf apex run test -c` shows 100% coverage and all tests pass.

---

## Section 2: SOQL and SOSL (Phase 3)

### Exercise 2.1 — Aggregate Queries with Aliases ★

**Objective:** Write GROUP BY queries and read AggregateResult by alias.

**Instructions:**
1. Create 3 Accounts, each with a different number of Contacts (5, 3, 1).
2. Write an aggregate SOQL: `SELECT AccountId, COUNT(Id) contactCount FROM Contact WHERE AccountId != null GROUP BY AccountId`.
3. Loop the `AggregateResult` list, casting `row.get('contactCount')` to `Integer`.
4. Write a second aggregate with `HAVING COUNT(Id) > 2` and verify only the 5-contact account appears.
5. Write a query using `AVG(Health_Score__c)` on Account and cast the result to `Decimal`.

**Verify:** You read aggregates only by alias, never by source field name.

---

### Exercise 2.2 — Dynamic SOQL with Injection Protection ★★

**Objective:** Build safe dynamic queries and demonstrate injection defense.

**Instructions:**
1. Write a method `searchAccounts(String searchTerm)` that builds:
   ```apex
   String query = 'SELECT Id, Name FROM Account WHERE Name LIKE \'%' + String.escapeSingleQuotes(searchTerm) + '%\' LIMIT 10';
   return Database.query(query);
   ```
2. Call it with `TechCorp` and verify results.
3. Call it with `' OR 1=1 --` and verify it returns 0 results (escaped).
4. Write a second method using bind variables: `Database.query('SELECT Id, Name FROM Account WHERE Name = :searchTerm')`.
5. Compare the two approaches and document when each is appropriate.

**Verify:** The escaped version returns 0 results for injection input. The bind version throws for LIKE patterns.

---

### Exercise 2.3 — SOSL Multi-Object Search ★★

**Objective:** Use SOSL to search across Account and Contact simultaneously.

**Instructions:**
1. Create an Account named "Northwind Traders" and a Contact named "North Windlass".
2. Execute SOSL: `FIND 'North' IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, FirstName, LastName)`.
3. Print `results[0]` size (Account matches) and `results[1]` size (Contact matches).
4. Write a test that uses `Test.setFixedSearchResults` to stub the SOSL results.
5. Assert the correct object order in the `List<List<SObject>>`.

**Verify:** Results[0] is Accounts, results[1] is Contacts. Test passes with fixed results.

---

### Mini Project 2: Universal Search Service ★★★

**Objective:** Build a search service that combines SOQL and SOSL for a unified search experience.

**Requirements:**
1. Create `SearchService.cls` with:
   - `public static List<SObject> searchAcrossObjects(String term)` — SOSL across Account, Contact, Lead.
   - `public static List<Account> searchAccountsWithChildren(String nameFilter, Integer minContacts)` — SOQL with subquery + HAVING.
   - `public static List<AggregateResult> countRecordsByObject()` — aggregate count across standard objects.
2. Create `SearchServiceTest.cls` with:
   - SOSL tests using `Test.setFixedSearchResults`.
   - Aggregate tests with setup data.
   - Edge case: empty search term, no matching records.

**Success criteria:** All tests pass; SOSL test uses fixed results; aggregate casts are correct.

---

## Section 3: Triggers and Order of Execution (Phase 4)

### Exercise 3.1 — Before-Trigger Defaulting ★

**Objective:** Set field defaults in a before insert trigger without extra DML.

**Instructions:**
1. Create a trigger `AccountDefaultTrigger on Account (before insert)` that:
   - Sets `Health_Score__c` to 70 when null.
   - Sets `Description` to `'Auto-created on ' + Date.today()` when null.
2. Insert an Account with only `Name` set.
3. Query it back and verify both fields were populated.
4. Insert 200 Accounts in one list and verify the trigger handled all records (no governor violation).

**Verify:** No second DML was used. The fields are saved with the insert.

---

### Exercise 3.2 — Change Detection in After-Update ★★

**Objective:** Act only when a specific field changes, not on every update.

**Instructions:**
1. Study the `Code_Review__c` object. Create a trigger `CodeReviewChangeTrigger on Code_Review__c (after update)`.
2. Compare `Trigger.oldMap[key].Review_Status__c` with `Trigger.newMap[key].Review_Status__c`.
3. Only when `Review_Status__c` changed, create an `Integration_Log__c` record marking the change.
4. Update a record changing `Comments__c` only — verify NO log is created.
5. Update the same record changing `Review_Status__c` — verify a log IS created.

**Verify:** Change detection works correctly; unrelated field changes are ignored.

---

### Exercise 3.3 — Recursion Guard Implementation ★★★

**Objective:** Prevent a trigger from re-entering itself when its own DML fires the trigger again.

**Instructions:**
1. Create a class `RecursionGuard.cls` with:
   - `private static Set<Id> processedIds = new Set<Id>()`.
   - `public static Boolean shouldProcess(Id recordId)` — returns true if not yet processed, adds to set.
   - `public static void markProcessed(Id recordId)` — adds to set.
   - `public static void reset()` — clears the set (for testing).
2. Write a trigger on `Account` (after update) that updates `Description` when `Health_Score__c` changes.
3. Use `RecursionGuard` to prevent infinite recursion.
4. Write a test that updates `Health_Score__c` and verifies `Description` was updated exactly once.
5. Assert `RecursionGuard` is reset at the start of each test.

**Verify:** No infinite loop; the trigger fires exactly twice (before validation + after update).

---

### Mini Project 3: Lead Auto-Assignment Engine ★★★

**Objective:** Build a complete trigger-driven lead routing system.

**Requirements:**
1. Create a custom setting or custom metadata `Lead_Routing_Rule__mdt` with fields:
   - `Industry__c` (text), `Owner__c` (lookup to User), `Priority__c` (number).
2. Create a trigger `LeadAutoAssignmentTrigger on Lead (before insert)` that:
   - Collects all `Industry` values from `Trigger.new`.
   - Queries matching `Lead_Routing_Rule__mdt` records sorted by `Priority__c`.
   - Assigns `OwnerId` from the first matching rule.
   - Sets a custom field `Assignment_Source__c` to `'Rule: ' + rule.Name`.
3. Create a handler class `LeadAssignmentHandler.cls` with `with sharing`.
4. Write `LeadAssignmentHandlerTest.cls` with:
   - Test data: 5 leads across 3 industries, some matching rules, some not.
   - Assertions: leads with matching rules are assigned correctly; leads without rules keep the default owner.
   - Bulk test: 200 leads in one insert.

**Success criteria:** Trigger is thin (one line delegating to handler). Handler is bulkified. All tests pass.

---

## Section 4: Async Apex and Platform Events (Phase 5)

### Exercise 4.1 — Queueable Apex Lifecycle ★

**Objective:** Enqueue a job, track it, and handle failures.

**Instructions:**
1. Create `SimpleQueueable.cls` implementing `Queueable`:
   - Constructor takes an `Id` of an `Async_Job_Monitor__c`.
   - `execute` method sets `Job_Status__c = 'Running'`, does work, then sets `Job_Status__c = 'Completed'`.
   - Add a constructor parameter `Boolean shouldFail` that causes an exception in `execute`.
2. In anonymous Apex:
   - Create an `Async_Job_Monitor__c` with `Job_Type__c = 'Queueable'`.
   - Enqueue `SimpleQueueable`.
   - Wait, then query the monitor to see status changes.
3. Repeat with `shouldFail = true` and verify `Job_Status__c = 'Failed'` and error message captured.

**Verify:** Status transitions work; exception is caught and recorded.

---

### Exercise 4.2 — Batch Apex with QueryLocator ★★

**Objective:** Process a large dataset in chunks using Batch Apex.

**Instructions:**
1. Insert 500 Accounts with varied `Health_Score__c` values.
2. Create `ScoreBatch.cls` implementing `Database.Batchable<sObject>`:
   - `start`: returns `Database.getQueryLocator('SELECT Id, Health_Score__c FROM Account')`.
   - `execute`: clamps scores to 0–100, sets null to 70, updates in one DML.
   - `finish`: logs completion.
3. Execute with scope 200 and count how many batches ran.
4. Execute with scope 2000 and compare.
5. Assert all accounts have valid scores after batch completion.

**Verify:** Scope 200 = 3 batches. Scope 2000 = 1 batch. All scores are 0–100.

---

### Exercise 4.3 — Platform Event Round Trip ★★

**Objective:** Publish events and verify subscriber materializes records.

**Instructions:**
1. Create a platform event `Test_Notification__e` with fields `Message__c` (text) and `Source__c` (text).
2. Create a trigger `TestNotificationTrigger on Test_Notification__e (after insert)` that:
   - Creates an `Integration_Log__c` for each event with `Payload__c = evt.Message__c`.
3. In anonymous Apex, publish 5 events in ONE `EventBus.publish` call.
4. Query `Integration_Log__c` and verify 5 records were created.
5. Add a recursion guard using `TriggerHandlerService.suppress` / `restore`.

**Verify:** 5 events → 5 log records. No infinite loop.

---

### Mini Project 4: Data Sync Pipeline ★★★

**Objective:** Build an end-to-end data synchronization pipeline using Queueable, Batch, and Platform Events.

**Requirements:**
1. Create `SyncConfig__c` custom metadata with fields:
   - `Object_Name__c`, `Last_Sync_Date__c`, `Batch_Size__c`.
2. Build `DataSyncService.cls` with:
   - `public static Id startSync(String objectName)` — reads config, enqueues a Queueable that:
     - Updates `Last_Sync_Date__c` on the config.
     - Publishes a `Sync_Event__e` platform event.
   - The `Sync_Event__e` subscriber trigger creates an `Integration_Log__c` entry.
3. Write `DataSyncServiceTest.cls`:
   - Test with `Test.startTest()` / `Test.stopTest()`.
   - Assert the config was updated.
   - Assert the event was published and materialized as a log.
4. Handle the recursion guard between the event subscriber and the log trigger.

**Success criteria:** Full pipeline works: enqueue → config update → event publish → log creation. No recursion.

---

## Section 5: Automation — Flows and Apex (Phase 6)

### Exercise 5.1 — @InvocableMethod for Flow ★

**Objective:** Expose an Apex method to Flow Builder.

**Instructions:**
1. Create `ScoreCalculatorService.cls` with:
   ```apex
   @InvocableMethod(label='Calculate Score' description='Clamps a score to 0-100.')
   public static List<Result> calculate(List<Request> requests) { ... }
   ```
   - `Request` inner class: `@InvocableVariable public Integer rawScore`.
   - `Result` inner class: `@InvocableVariable public Integer clampedScore`.
2. Create a test class that calls the method directly (static Apex call) and asserts clamping behavior.
3. Test edge cases: null input, negative, 0, 100, 150.

**Verify:** Method is static, takes List<Request>, returns List<Result>. All edge cases pass.

---

### Exercise 5.2 — Flow vs Trigger Decision Matrix ★★

**Objective:** Document when to use Flow vs Apex for a set of scenarios.

**Instructions:**
1. For each scenario below, write a 1-sentence justification for your choice:
   - (a) Set `Health_Score__c` to 70 when a new Account is created with a blank score.
   - (b) Send a custom email to the Account owner when the score drops below 30.
   - (c) Recalculate scores for all Accounts nightly in a batch.
   - (d) Show a screen collecting user input before creating a Contact.
   - (e) Call an external API when an Opportunity closes.
   - (f) Create 3 child records when an Account is created.
2. For scenarios (a) and (b), build both: a before-save Flow AND a before-trigger. Compare the DML footprint.

**Verify:** You can defend each choice with a specific Apex/Flow limitation or advantage.

---

### Mini Project 5: Onboarding Wizard ★★★

**Objective:** Build a screen Flow that collects user input and calls invocable Apex.

**Requirements:**
1. Create `OnboardingService.cls`:
   - `@InvocableMethod` that takes a Company Name, Contact Name, and Industry.
   - Creates an Account and Contact in one transaction.
   - Returns the Account Id.
2. Create a **Screen Flow** (`Onboarding_Wizard`) with:
   - Screen 1: Company Name (required), Industry (picklist).
   - Screen 2: Contact First Name, Last Name (required).
   - Apex Action: calls `OnboardingService`.
   - Screen 3: "Account created: {!accountId}".
3. Write `OnboardingServiceTest.cls` covering the invocable method.
4. Deploy both the Apex class and the Flow metadata.

**Success criteria:** Flow is activatable; Apex test passes; the invocable creates both records.

---

## Section 6: UI Foundations — Visualforce, Aura, and LWC (Phases 7–8)

### Exercise 6.1 — Visualforce Custom Controller ★

**Objective:** Build a search page with a custom controller.

**Instructions:**
1. Create `AccountSearchController.cls`:
   - Public properties: `searchTerm` (String), `accounts` (List<Account>).
   - Method `search()`: queries Accounts by `Name LIKE :searchTerm` with limit 50.
2. Create `AccountSearchPage.page` with:
   - `<apex:page controller="AccountSearchController">`
   - Input field bound to `{!searchTerm}`.
   - CommandButton calling `{!search}` with `reRender="results"`.
   - `pageBlockTable` rendering `{!accounts}` with Name and Industry columns.
   - `apex:pageMessages` for error display.
3. Open the page in the browser and test a search.

**Verify:** Partial page refresh works (reRender). No full page reload on search.

---

### Exercise 6.2 — Aura Component with Server Call ★★

**Objective:** Build an Aura component that calls `@AuraEnabled` Apex.

**Instructions:**
1. Create `AccountAuraController.cls` with:
   ```apex
   @AuraEnabled(cacheable=true)
   public static List<Account> getTopAccounts() {
       return [SELECT Id, Name, Health_Score__c FROM Account ORDER BY Health_Score__c DESC LIMIT 10];
   }
   ```
2. Create an Aura component `accountAuraList` with:
   - An `init` handler calling `c.getTopAccounts`.
   - `aura:iteration` rendering each Account's Name and Score.
   - `aura:registerEvent` for an `AccountSelected` application event.
3. Create the `AccountSelected` event definition.
4. On row click, fire the application event with the Account Id.

**Verify:** `$A.enqueueAction` returns data. Application event fires on click.

---

### Exercise 6.3 — LWC with Wire and Imperative ★★

**Objective:** Build an LWC with both `@wire` (read) and imperative (write) paths.

**Instructions:**
1. Create `LwcAccountList` component:
   - `@wire` calling `LwcDataService.getAccountsWithContacts`.
   - `lightning-datatable` displaying accounts.
   - Handle wire `{data, error}`.
2. Add a button "Refresh" that calls `refreshApex` to force re-fetch.
3. Add an imperative button "Create Test Account" that calls an `@AuraEnabled` (non-cacheable) method and then `refreshApex`.
4. Write the `.js-meta.xml` targeting `lightning__AppPage`.
5. Deploy and add to a page via App Builder.

**Verify:** Wire loads data on init. Imperative creates a record. Refresh shows updated data.

---

### Exercise 6.4 — LWC Parent-Child Communication ★★

**Objective:** Pass data down with `@api` and up with `CustomEvent`.

**Instructions:**
1. Create parent `accountManager` and child `accountCard`.
2. Parent passes `account` to child via `@api account`.
3. Child renders account details and has a "Delete" button.
4. On delete, child dispatches `CustomEvent('accountdelete', { detail: this.account.Id })`.
5. Parent handles `onaccountdelete`, removes the account from its tracked list.
6. Verify the child re-renders when the parent's list changes.

**Verify:** Data flows down via `@api` and up via `CustomEvent`. No imports needed for event dispatch.

---

### Mini Project 6: Full-Stack Account Dashboard ★★★

**Objective:** Build a complete dashboard with Visualforce, Aura, and LWC approaches.

**Requirements:**
1. **Visualforce page** `AccountDashboard.page`:
   - Shows account list with health scores.
   - Inline edit of `Health_Score__c` with save button.
   - Uses `apex:commandButton` with `reRender`.
2. **Aura component** `accountDashboardAura`:
   - Wired data load.
   - Application event for account selection.
   - Child detail panel showing selected account's Contacts.
3. **LWC** `accountDashboardLwc`:
   - `@wire` with `lightning-datatable`.
   - Imperative save button.
   - `refreshApex` after save.
   - Custom event for selection.
4. All three share the same `@AuraEnabled` Apex controller.
5. Write tests for the Apex controller methods.

**Success criteria:** All three UI approaches work. Controller is shared. Tests pass.

---

## Section 7: Testing and Debugging (Phase 9)

### Exercise 7.1 — @TestSetup and Data Isolation ★

**Objective:** Verify SeeAllData=false behavior.

**Instructions:**
1. Create `DataIsolationTest.cls` with `@TestSetup`:
   - Insert 3 Accounts.
2. Write test method `onlySetupDataVisible`:
   - Query all Accounts.
   - Assert exactly 3 exist (no org data leaked).
3. Write test method `secondTestSeesSameSetupData`:
   - Query Accounts.
   - Assert exactly 3 exist (setup data shared across methods).
4. Write test method `addingRecordsWithinMethod`:
   - Insert 2 more Accounts.
   - Query and assert 5 total (3 setup + 2 method-level).

**Verify:** All three assertions pass. Data isolation is proven.

---

### Exercise 7.2 — Test.startTest/stopTest for Queueable ★★

**Objective:** Force async completion and verify fresh governor limits.

**Instructions:**
1. Write a test for a queueable job:
   ```apex
   Test.startTest();
   System.enqueueJob(new SimpleQueueable(monitorId));
   Test.stopTest();
   // assertions here — job has completed
   ```
2. Inside the test, print `Limits.getQueries()` before and after `Test.startTest()`.
3. Verify the governor counters reset inside the start/stop window.
4. Assert the `Async_Job_Monitor__c` record has `Job_Status__c = 'Completed'`.

**Verify:** Without startTest/stopTest, the assertion would fail (job not yet executed).

---

### Exercise 7.3 — HTTP Callout Mock ★★★

**Objective:** Mock an external API and test retry logic.

**Instructions:**
1. Create `MockApiService implements HttpCalloutMock`:
   - First call returns 502.
   - Second call returns 200.
   - Track attempt count.
2. Write a test:
   ```apex
   Test.setMock(HttpCalloutMock.class, new MockApiService());
   IntegrationService.CalloutResult result = IntegrationService.callOutbound('GET', '/health', null);
   System.assert(result.success);
   ```
3. Assert the `Integration_Log__c` record shows `Retry_Count__c = 1`.
4. Create a second mock `MockApiFailAll` that always returns 500.
5. Test that after retries, the result is `success = false`.

**Verify:** Both mocks are installable. Retry count is accurate in the log.

---

### Mini Project 7: Comprehensive Test Suite ★★★

**Objective:** Write tests for the Lead Auto-Assignment Engine (Mini Project 3).

**Requirements:**
1. `@TestSetup` creates:
   - 3 Users (admin, standard, read-only).
   - 5 Lead Routing Rules across 4 industries.
   - 10 Leads across those industries (some matching, some not).
2. Test methods:
   - `leadsWithMatchingRulesAreAssignedCorrectly` — assert OwnerId matches the rule.
   - `leadsWithoutMatchingRulesKeepDefaultOwner` — assert owner is the running user.
   - `bulkInsertHandles200Leads` — insert 200 leads, assert no governor violations.
   - `updateTriggerReEvaluatesAssignment` — change Lead Industry, verify reassignment.
   - `recursionGuardPreventsInfiniteLoop` — trigger update that would re-fire, assert stable.
3. All assertions use `System.assertEquals` with descriptive messages.

**Success criteria:** `sf apex run test -c` shows ≥75% coverage. All tests green.

---

## Section 8: Performance and Large Data Volumes (Phase 10)

### Exercise 8.1 — Query Plan Analysis ★

**Objective:** Compare selective vs non-selective queries.

**Instructions:**
1. Insert 500 Accounts with varied Industries and Health Scores.
2. Open Developer Console → Query Plan.
3. Paste these queries one at a time and record cost:
   - `SELECT Id FROM Account WHERE Health_Score__c > 50` (indexed field).
   - `SELECT Id FROM Account WHERE Name LIKE '%Corp%'` (leading wildcard).
   - `SELECT Id FROM Account WHERE Name LIKE 'Corp%'` (no leading wildcard).
   - `SELECT Id FROM Account WHERE Health_Score__c > 50 AND Industry = 'Technology'` (compound).
4. Add a custom index on `Health_Score__c` and re-plan the first query.
5. Document cost differences.

**Verify:** Leading wildcard shows highest cost. Indexed field shows lowest.

---

### Exercise 8.2 — Map Join vs Nested Loop ★★

**Objective:** Measure the performance improvement of Map joins.

**Instructions:**
1. Insert 10 Accounts and 500 Contacts distributed across them.
2. Write a method `nestedLoopJoin(List<Account> accounts, List<Contact> contacts)`:
   - O(n*m) nested loop matching `c.AccountId == a.Id`.
   - Track `Limits.getCpuTime()` before and after.
3. Write a method `mapJoin(List<Account> accounts, List<Contact> contacts)`:
   - Build `Map<Id, List<Contact>>` by AccountId.
   - Look up each account's contacts via `map.get(acc.Id)`.
   - Track CPU time.
4. Call both in a test, print both CPU times.
5. Assert the map join is faster.

**Verify:** Map join CPU time is significantly lower than nested loop.

---

### Mini Project 8: LDV Migration Tool ★★★

**Objective:** Build a batch process that migrates Account data with performance monitoring.

**Requirements:**
1. Create `AccountMigrationBatch.cls` implementing `Database.Batchable<sObject>, Database.Stateful`:
   - `start`: `QueryLocator` over all Accounts.
   - `execute`: transforms data (normalizes names, clamps scores), uses Map for child Contact lookups, updates in one DML.
   - `finish`: logs total records processed, total CPU used, total DML statements.
   - Instance fields track: `totalRecords`, `totalBatches`, `maxCpuInBatch`.
2. Create `AccountMigrationTest.cls`:
   - Insert 500 accounts with contacts.
   - Run batch with scope 200.
   - Assert all accounts have normalized data.
   - Assert `Database.Stateful` fields are accurate.
3. Monitor with `Async_Job_Monitor__c`.

**Success criteria:** Batch processes all records. Stateful counters are accurate. Performance is within limits.

---

## Section 9: Integration and Enterprise Patterns (Phase 11)

### Exercise 9.1 — Named Credential Callout ★

**Objective:** Make a callout using a Named Credential.

**Instructions:**
1. In Setup → Named Credentials, create `Mock_API` pointing to a mockable endpoint.
2. Write an anonymous Apex block:
   ```apex
   HttpRequest req = new HttpRequest();
   req.setEndpoint('callout:Mock_API/test');
   req.setMethod('GET');
   Http http = new Http();
   HttpResponse res = http.send(req);
   System.debug('Status: ' + res.getStatusCode());
   System.debug('Body: ' + res.getBody());
   ```
3. Inside a test, mock the callout and assert the response.
4. Verify the `Integration_Log__c` captures the endpoint and status.

**Verify:** Named Credential reference works without hardcoded URLs. Log entry is created.

---

### Exercise 9.2 — REST Resource CRUD ★★

**Objective:** Build an inbound REST API with full CRUD operations.

**Instructions:**
1. Create `@RestResource(urlMapping='/MyService/v1/items/*')` with:
   - `@HttpGet` — returns a list of records.
   - `@HttpPost` — creates a record, returns 201 + Id.
   - `@HttpPatch` — updates a record by Id from URI.
   - `@HttpDelete` — deletes a record by Id from URI.
2. Write `RestServiceTest.cls`:
   - Test each HTTP method by calling the service methods directly (not via HTTP).
   - Use `RestContext.request` / `RestContext.response` mocking.
3. Verify CRUD operations produce correct status codes and records.

**Verify:** Each verb works. Status codes are correct (200, 201, 204).

---

### Exercise 9.3 — Event-Driven Integration Pipeline ★★★

**Objective:** Build a publish-subscribe pipeline with audit logging.

**Instructions:**
1. Study the repo's pipeline: `IntegrationService` → `Integration_Log__c` → `IntegrationLogTrigger` → `EventPublisherService` → `Integration_Event__e` → `IntegrationEventSubscriberTrigger` → `Integration_Log__c`.
2. Reproduce this pipeline for a new custom object `Webhook_Event__e`.
3. Add recursion guards at every trigger level.
4. Write a test that:
   - Publishes 10 events.
   - Verifies 10 log entries are created.
   - Verifies no infinite recursion.
   - Asserts correlation IDs are consistent.

**Verify:** Pipeline works end-to-end. Recursion guards are effective.

---

### Mini Project 9: External API Hub ★★★

**Objective:** Build a complete integration layer with outbound callouts, inbound REST, and event-driven sync.

**Requirements:**
1. **Outbound Service** `ExternalApiService.cls`:
   - Uses Named Credentials.
   - Retry logic (5xx → retry once → log failure).
   - Correlation Id tracking.
   - Integration_Log__c audit trail.
2. **Inbound Service** `WebhookReceiver.cls`:
   - `@RestResource` receiving external webhooks.
   - Validates payload, creates a `Webhook_Event__e`.
   - Returns 200 on success, 400 on bad payload.
3. **Event Subscriber** `WebhookEventTrigger` on `Webhook_Event__e`:
   - Creates `Integration_Log__c` with direction 'Inbound'.
   - Recursion guard via `TriggerHandlerService`.
4. **Test Suite**:
   - Mock for outbound callouts.
   - REST context simulation for inbound.
   - Event publish + subscriber assertion.
   - End-to-end: outbound callout → log → trigger → event → subscriber → log.

**Success criteria:** All tests pass. Pipeline is fully auditable. No recursion.

---

## Section 10: Release Management and CI/CD (Phase 12)

### Exercise 10.1 — Scratch Org Lifecycle ★

**Objective:** Create, deploy, test, and destroy a scratch org.

**Instructions:**
1. `sf org create scratch -f config/project-scratch-def.json -a test1 -d 1`
2. `sf project deploy start --source-dir force-app --target-org test1`
3. `sf apex run test -c --target-org test1 --test-level RunLocalTests --result-format human`
4. Record the coverage percentage.
5. `sf org delete scratch --target-org test1 --no-prompt`
6. Repeat steps 1–5 with a second scratch org (`test2`) to prove the process is repeatable.

**Verify:** Both orgs created and destroyed. Coverage is consistent.

---

### Exercise 10.2 — Destructive Deployment ★★

**Objective:** Remove metadata via destructive changes.

**Instructions:**
1. Create a dummy class `StaleHelper.cls` (empty class).
2. Deploy it to a scratch org.
3. Verify it exists: `sf apex run test -c` includes it in coverage.
4. Create `destructiveChanges.xml`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Package xmlns="http://soap.sforce.com/2006/04/metadata">
       <types>
           <members>StaleHelper</members>
           <name>ApexClass</name>
       </types>
       <version>68.0</version>
   </Package>
   ```
5. Create an empty `package.xml` for the same API version.
6. Deploy both files together.
7. Verify `StaleHelper` no longer exists.

**Verify:** Class is removed from the org. Deployment succeeds with both files.

---

### Mini Project 10: Full CI/CD Pipeline ★★★

**Objective:** Set up a GitHub Actions CI/CD pipeline for the repo.

**Requirements:**
1. Create `.github/workflows/ci.yml` with:
   - Trigger on `push` to `main` and `pull_request`.
   - Steps: checkout → install SF CLI → authorize DevHub → create scratch org → deploy → lint → test with coverage → scan → teardown.
2. Add a `package.json` script for linting: `"lint": "eslint force-app/**/*.js"`.
3. Add `sf scanner` step for Apex static analysis.
4. Configure the pipeline to fail on:
   - Lint errors.
   - Test failures.
   - Coverage below 75%.
5. Add a separate `deploy-prod` job that:
   - Only runs on `main` push (not PRs).
   - Uses `sf project deploy start` with `--test-level RunLocalTests`.
   - Includes a manual approval gate (GitHub Environments).

**Success criteria:** Pipeline runs on PR. Lint/test/scan gates work. Deploy-prod requires approval.

---

## Cross-Phase Capstone Project ★★★★

### Capstone: Certification Quiz Platform

**Objective:** Build a complete quiz application using every phase of the roadmap.

**Requirements:**

**Phase 1–2 (Data Model & Apex):**
- Custom objects: `Quiz__c`, `Question__c`, `Answer__c`, `Quiz_Result__c`.
- Relationships: Quiz → Questions (master-detail), Question → Answers (master-detail).
- Service class with full CRUD, collections, and custom exceptions.

**Phase 3 (SOQL/SOSL):**
- Query questions by difficulty, domain, and certification type.
- SOSL for full-text search across question text.
- Aggregate queries for score statistics.

**Phase 4 (Triggers):**
- Before-insert trigger on `Question__c` to validate and normalize text.
- After-update trigger on `Quiz_Result__c` to publish a notification event.

**Phase 5 (Async & Events):**
- Queueable job to calculate quiz statistics.
- Platform event `Quiz_Completed__e` published after quiz submission.
- Batch job for nightly statistics aggregation.

**Phase 6 (Flows):**
- `@InvocableMethod` for quiz scoring callable from Flow.
- Screen Flow for the quiz-taking wizard.

**Phase 7–8 (UI):**
- LWC quiz interface with `@wire` for questions and imperative submit.
- Aura component for the leaderboard.
- Visualforce page for admin question management.

**Phase 9 (Testing):**
- `@TestSetup` with question bank.
- HTTP mock for external scoring API.
- `System.runAs` for multi-user quiz scenarios.
- 100% coverage with meaningful assertions.

**Phase 10 (Performance):**
- Map joins for answer grouping.
- Batch job for large-scale statistics.
- Index-aware queries.

**Phase 11 (Integration):**
- REST API for external quiz submission.
- Platform events for quiz completion notifications.
- Integration log audit trail.

**Phase 12 (CI/CD):**
- GitHub Actions pipeline.
- Destructive changes for deprecated quiz versions.
- Package versioning.

**Success criteria:**
- `sf apex run test -c` shows ≥75% coverage, all tests pass.
- All metadata deploys cleanly.
- LWC renders in a scratch org.
- REST endpoint is callable from Postman.
- Pipeline runs without errors.

---

## Difficulty Legend

| Rating | Description |
|--------|-------------|
| ★ | Beginner — single concept, guided steps |
| ★★ | Intermediate — multiple concepts, some decision-making |
| ★★★ | Advanced — multi-phase integration, design decisions required |
| ★★★★ | Expert — full application across all roadmap phases |
