# Phase 9: Testing and Debugging

Code that cannot be proven is code that ships bugs. Salesforce funnels all shippable metadata through Apex tests, and this phase is where you turn "my class compiles" into "my class is deployable". It is the shared foundation of both the PDI and PDII testing domains.

## Learning Objectives

By the end of this phase, you will be able to:
- Structure an `@isTest` class: test methods, `@TestSetup`, and the `SeeAllData` model.
- Control execution context with `System.runAs` and `Test.startTest`/`stopTest`.
- Use the assertion family and the `Limits` API inside tests.
- Mock HTTP callouts with `HttpCalloutMock`/`Test.setMock` and SOSL with fixed results.
- Explain the 75% overall code-coverage rule and the deployment test levels.
- Debug with System.debug, debug logs, and the `sf apex run test` reporting surface.

## 1. Test Class Anatomy

Every Apex test is an `@isTest` class containing `static` `@isTest` methods:

```apex
@isTest
private class DeveloperFundamentalsTest {

    @TestSetup
    static void makeData() {
        Account acct = new Account(Name = 'Dev Roadmap Food Co');
        insert acct;
        Contact mentor = new Contact(FirstName = 'Ada', LastName = 'Lovelace', AccountId = acct.Id);
        insert mentor;
    }

    @isTest
    static void insertionAndGuardActsOnIsolatedData() {
        List<Account> accounts = [SELECT Id, Name FROM Account];
        System.assert(accounts.size() == 1, 'Only @TestSetup data is visible');
        System.assertEquals('Dev Roadmap Food Co', accounts[0].Name);
    }
}
```

The rules:

- Test classes are conventionally `private` and always annotated `@isTest` (test data and test classes are **not counted** toward org code coverage; they are excluded from your coverage report).
- Test methods are `static`, take no arguments, return `void`, and are never callable at runtime.
- Every test method ends with an **assertion** — a test without asserts covers lines but proves nothing.
- Run with `sf apex run test -c` (adds coverage) or `sf apex run test -r human` (readable report).

## 2. Data Isolation and SeeAllData

Since Spring '16, **`SeeAllData` defaults to `false`**: every test sees only the data it creates (inserts in the same test or `@TestSetup`), not the org's existing records. Consequences you must internalise:

- Never write `WHERE` clauses that depend on org data; your test must fabricate its own rows.
- **`@TestSetup`** runs once per test class, before any test method; every method receives the same freshly-committed setup rows. Copying rules: setup data is rolled back, then each method's own inserts commit and roll back independently.
- **`@isTest(SeeAllData=true)`** re-enables legacy access for rare cases (read-only sharing/system metadata). The exam insists its defaults are false and you only opt in when unavoidable (e.g., reading a custom setting you can't create in test).
- Isolated-data town carries a benefit: tests are faster, tighter, and portable.

Cross-check with the repo: `DeveloperFundamentalsTest.insertionAndGuardActsOnIsolatedData` literally asserts "the only visible Account is the one this class created."

## 3. Execution Context Control

Three tools shape *who* runs and *when* async work runs:

### System.runAs(user)

Runs a block in the named user's context — CRUD/FLS/sharing apply, and **you and your test runner's licenses don't complicate it** (System.runAs always runs as system context for the assertion itself):

```apex
User lowPriv = createLimitedUser();          // Profile 'Standard User'
System.runAs(lowPriv) {
    // permissions, sharing, and FLS are now those of lowPriv
}
```

Must-haves: the User must exist in the database (insert it), and the profile page layout/permission-set math is why `SecurityServiceTest` builds a fresh `Standard User` inside `@TestSetup`. One `System.runAs` per method.

### Test.startTest() / Test.stopTest()

Async work is deferred. Wrapping the enqueue trigger point:

```apex
Test.startTest();
AsyncJobService.enqueueMonitor(monitor);   // queueable is now pending
Test.stopTest();                            // forces it to run to completion
// assertions about the job's effects are now valid
```

Additionally, the window between startTest and stopTest gets **fresh governor limits**, so heavy-but-legit workloads can be tested without the test's own setup consumption. This pairing is *mandatory* for queueables, schedulables, batches, and platform-event deliveries — `AsyncJobServiceTest` and `EventPublisherServiceTest` lean entirely on it.

## 4. The Assertion Family and Limits Pitfalls

| Statement | Purpose |
|-----------|---------|
| `System.assert(condition, msg)` | sanity check |
| `System.assertEquals(expected, actual, msg)` | equality |
| `System.assertNotEquals(unexpected, actual, msg)` | inequality |

Beyond asserts, a robust test verifies **governor behaviour** with the `Limits` API:

```apex
System.debug('queries used: ' + Limits.getQueries());
System.assert(Limits.getQueries() <= Limits.getLimitQueries());
```

`DeveloperFundamentalsTest.limitsUtilsReflectTheTransactionShape` models this habit. Knowing "the transaction used 3 of 100 SOQL" is a legitimate coverage target (Phase 10 metrics).

Pitfalls the exam knowingly stages:

- **Data-creating DML inside a test** still counts against DML/query limits; even tests can exceed 100 SOQL.
- `System.runAs` with a user who has no record access expects *empty* result sets, not errors — assert the empty list.
- Setup data is shared, so a test method that mutates a setup record changes it **for the assertion only** — subsequent methods get fresh setup rows again.
- Capturing exceptions: `try { ... } catch (DmlException e) { caught = e; }` and assert `caught != null`, never assert "quiet success".

## 5. Mocking the Outside World

**Real HTTP calls are forbidden in Apex tests.** The contract: implement `HttpCalloutMock`, install it with `Test.setMock`, and every `http.send(request)` is answered by your fake:

```apex
private class MockRetryable implements HttpCalloutMock {
    private Integer attempts = 0;
    public HttpResponse respond(HttpRequest req) {
        attempts++;
        HttpResponse res = new HttpResponse();
        res.setStatusCode(attempts == 1 ? 502 : 200);
        res.setBody('{"attempt":' + attempts + '}');
        return res;
    }
}

@isTest
static void callOutboundSucceedsAgainst2xxMock() {
    Test.setMock(HttpCalloutMock.class, new MockRetryable());
    IntegrationService.CalloutResult outcome =
        IntegrationService.callOutbound('GET', '/health', null);
    System.assert(outcome.success);
}
```

Related mocks: `StaticResourceCalloutMock` (serve a static resource body), `MultiStaticResourceCalloutMock`, and for SOSL **`Test.setFixedSearchResults(List<List<SObject>>)`** — search indexes aren't guaranteed in tests, so you feed known result lists directly (see `SoqlSoslServiceTest.soslUsesFixedSearchResultsDeterministically`). Test seams: pure logic helpers (`InboundRestService.fetchRecentLogs`, `.createIntegrationLog`) are tested directly while the thin `RestContext` wrappers stay framework-adjancent.

## 6. The 75% Coverage Rule and Deployment Constraints

Production deployment (via **metadata API, sf deploy, or change sets to production**) is blocked unless your org meets the documented Apex rules:

1. **75% covered lines org-wide** — at least three quarters of all Apex code (executable lines, excluding test code) must be exercised by tests.
2. **Every Apex trigger must have some coverage** (each trigger's logic is hit by at least one test).
3. **All classes and triggers must compile successfully** (zero compile errors in the org).

Coverage is **per-org**, which is why running `sf apex run test -c` against the whole scratch org (or running all local tests before a push) gives you the real number. When deploying with the CLI you pick a **test level**: `RunLocalTests` (deploy's tests), `RunAllTestsInOrg`, `RunSpecifiedTests`, or `NoTestRun` (dev orgs/sandboxes allows simulation). For **production** you can't say "no tests".

Coverage best practices that also improve code quality:

- Cover both the happy path and the error path (each `catch` is executable code).
- Test **each trigger event** independently (insert/update/delete), because a 75%-covered line that only ran on insert leaves the update path unexposed.
- Include boundary data: empty lists, nulls, `Limits` edges — the tests in this repo deliberately insert a 205-opportunity case (child cap), orphan contacts (map join skips them), and a 150 Health_Score to break the clamp.
- Use `@TestSetup` to amortise expensue setup; avoid calling anything that needs `WebService`-access mocking repeatedly.

Coverage also has an anti-pattern the exam flags: **assert-free tests**. A method is "covered" the moment executed; assertions are how you prove semantics, so a test that only runs the class is the classic trick the exam's "which of these is a correct testing approach" questions punish.

## 7. Testing-as-Scratch-Org Practice

The repo is test-first: every service class ships its `*Test.cls` sibling, and the whole suite runs from one command against a scratch org:

```
sf org create scratch -f config/project-scratch-def.json -a dev
sf project deploy start --source-dir force-app
sf apex run test -c --test-level RunLocalTests --result-format human
```

`--result-format human` renders per-class pass/fail and test names; `-c` appends the coverage percentage. For drill-down: the `.sfdx/tools/testresults` folder contains the CI-grade XML/JSON artifacts this repo's pipeline (`.husky/pre-commit`, GitHub Actions-adjacent scripts) consume.

## 8. Debugging: Logs, Limits, and REPLays

- **Apex debug logs**: capture `System.debug` output for a user or a class; read them in Developer Console, or `sf apex run` + `sf apex log` streams from CI.
- **Log levels** (ERROR/WARN/INFO/DEBUG/FINE/FINER/FINEST/None) — set the class-level filter to DEBUG to see `System.debug(...)` calls, FINEST to see `Limits` and DML traces.
- **Apex Replay Debugger** lets you set breakpoints in published class code (it replays a captured log). PDII touches it conceptually; priority is low vs manual assertion discipline.
- `Limits.getQueries/getDmlStatements/getCallouts` and their `getLimit*` twins are your runtime probe — the exam literally shows you `Limits` questions where the answer is a `LimitException` from an exhausted governor.

## Hands-On Exercises

### Exercise 1: Assertion-driven test authoring

1. Pick `SoqlSoslService.countContactsByAccount` — write a test that inserts 2 contacts across 2 accounts and asserts the alias-cast count per group.
2. Add a test for the empty case: no contacts → `rows.isEmpty()` true; assert against the code's actual behaviour, not an assumption.

### Exercise 2: runAs and sharing filtering

1. In a test, create two Accounts and a low-privilege Standard User (copy the pattern from `SecurityServiceTest`).
2. `System.runAs(lowPriv) { [SELECT Id FROM Account]; }` and both count rows and observe behaviour differences between `with`/`without` sharing classes.

### Exercise 3: Mock a callout and a SOSL

1. Extend `IntegrationServiceTest` with a mock returning 404 for an unknown resource; assert `outcome.success == false` and the `Integration_Log__c` row records `Status__c='Failed'`.
2. Add a `Test.setFixedSearchResults` test to `searchAccounts` and assert `results[1]` (Contact hits) is empty by design.

### Exercise 4: startTest/stopTest for a batchable

1. Modify `AsyncJobServiceTest.batchRecalculatesScoresAcrossChunks` to assert `clampScore(null)==70` directly.
2. Add a `Database.Stateful` counter to `HealthScoreRecalculator` and assert the accumulated total in a new test.

### Exercise 5: Coverage measurement

1. Run `sf apex run test -c` and read the per-class percentages.
2. Delete a test method and re-run to watch the org-wide number move below a threshold — then restore the method. Knowing *why* that bar exists is the exam point.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **`@isTest`** | Annotation marking test classes and methods; excluded from coverage and org limits counting. |
| **`@TestSetup`** | Runs once per class; shared, rolled-back data for every test method. |
| **`SeeAllData=false`** | Default isolation: tests only see data they created. |
| **`System.runAs`** | Run a block under a specified user's context (CRUD/FLS/sharing). |
| **`Test.startTest/stopTest`** | Async-forcing window with fresh governor limits for the code under test. |
| **Assertion** | `System.assert(assertEquals/assertNotEquals)` proving outcomes; mandatory for "real" coverage. |
| **`Limits` API** | Introspection of governor consumption (`getQueries`, `getDmlStatements`, ...). |
| **`HttpCalloutMock`** | Mock interface replacing real HTTP in tests; installed with `Test.setMock`. |
| **`Test.setFixedSearchResults`** | Deterministic SOSL results in tests. |
| **75% coverage** | Org-wide Apex line coverage required before production deployments. |
| **Test level** | Deployment choice: RunLocalTests / RunAllTestsInOrg / RunSpecifiedTests / NoTestRun. |
| **Apex Replay Debugger** | Debugger replaying a captured debug log against source breakpoints. |

## Certification Checkpoints

- [ ] I can write an `@isTest` class with `@TestSetup` and isolated `SeeAllData=false` assertions.
- [ ] I know the 75% rule, the "every trigger tested" rule, and the compile rule.
- [ ] I can mock a callout (`Test.setMock`) and SOSL (`setFixedSearchResults`).
- [ ] I can force async completion with `Test.startTest/stopTest` and explain the fresh-limits window.
- [ ] I can use `System.runAs` to verify sharing-mode differences.
- [ ] I can run `sf apex run test -c` and read the human-format report.
- [ ] I can debug with `System.debug` + log-filter levels and the `Limits` API.