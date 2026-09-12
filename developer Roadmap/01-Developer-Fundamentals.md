# Phase 1: Developer Fundamentals

The foundation of the certification: how Salesforce stores and exposes data, how relationships connect objects, the basic read/write ("SOQL + DML") toolkit, and the security model every Apex developer must respect.

## Learning Objectives

By the end of this phase, you will be able to:
- Explain the multitenant org model and how metadata, data, and platform features are layered.
- Distinguish standard objects, custom objects, and the fields/records they contain.
- Model the core Sales Cloud data model (Account, Contact, Opportunity) and the relationship types that join records.
- Write a first SOQL query that traverses a parent-child relationship.
- Perform insert, update, upsert, delete, and undelete with both the DML statement and the `Database` class.
- Contrast system context with user context and choose `with sharing`, `without sharing`, or `inherited sharing` correctly.
- Read the lab's test class (`DeveloperFundamentalsTest.cls`) and run it from the CLI.

## 1. The Salesforce Org Model

Salesforce is a **multitenant platform**: thousands of customers share the same core infrastructure and data-application servers while each **org** (the customer's configured environment, a "subscriber org") sees only its own data. Five key consequences shape every developer decision:

1. **Governor limits exist.** Since tenants share CPU, memory, heap, and query capacity, the platform enforces usage "governors" per transaction. The exam asks about these constantly (full table in Phase 10).
2. **Metadata is declarative.** Almost everything a developer builds—objects, fields, validation rules, flows, permission sets—is configuration stored as metadata, and from Spring '22 onward that metadata is source-tracked and deployable via the `sf` CLI.
3. **The schema is introspectable.** `Schema.getGlobalDescribe()` and per-object describe calls let Apex discover objects and fields at runtime (see `SecurityService.cls` in Phase 9).
4. **Identity is running-user scoped.** Queries and DML respect who is running the code unless you opt out (Section 4 of this phase).
5. **All state lives in the record.** Salesforce is not a relational system in the traditional sense; it exposes *objects*, *fields*, and *records*.

In this repo, the org shape you will repeatedly touch is the Developer Edition scratch org declared in `config/project-scratch-def.json` (edition `Developer`, API version 68.0 from `sfdx-project.json`). You create it with:

```
sf org create scratch -f config/project-scratch-def.json -a dev
```

### Objects, Fields, Records

The mapping is intuitive for anyone who has seen a spreadsheet:

| Salesforce term | Relational analogy | Example |
|-----------------|-------------------|---------|
| **Object** | Table | `Account`, `Opportunity`, `Training_Question__c` |
| **Field** | Column | `Account.Name`, `Account.Health_Score__c` |
| **Record** | Row | one specific account |

**Standard objects** ship with the platform: `Account`, `Contact`, `Opportunity`, `Lead`, `Case`, `Task`, `Campaign`, and dozens more. **Custom objects** end with `__c` and are built by developers/administrators. This repo's custom objects are the heart of its study data:

- `Async_Job_Monitor__c` — tracks background job progress (Phase 5)
- `Integration_Log__c` — audit trail for every inbound/outbound API call (Phase 11)
- `Code_Review__c` — code-review decisions with a managed-sharing demo (Phase 9)
- `Training_Question__c` — the certification question bank (Phase 13)
- `Study_Plan__c` — the 13-phase study plan generator (Phase 13)
- `Integration_Event__e` — a **platform event** object (the `__e` suffix; Phases 5/11)

Custom fields on standard objects follow the same `__c` naming: `Account.Health_Score__c`, `Opportunity.Deal_Quality_Score__c`, `Contact.Cert_Goal__c`, `Lead.Enrollment_Status__c`, `Case.Escalation_Level__c`, and `Task.Focus_Area__c` all exist in this repo.

Other suffixes to recognise on sight: `__e` = platform event, `__b` = big object, `__c` = custom object/field, and custom metadata/objects ending in `__mdt`. The absence of a suffix means standard.

### Data Types

Field types fall into familiar categories: **Text**, **Number** (integer or decimal), **Picklist** (single- and multi-select), **Date**, **DateTime**, **Checkbox** (Boolean), **Currency**, **Percent**, **Email**, **Phone**, **URL**, **TextArea**, **Long Text Area**, **Formula**, **Roll-Up Summary** (only on detail objects of a master-detail), **Auto Number**, and **External ID**. Formula and roll-up summary fields are *read only* from Apex; you can never `insert` or `update` their values directly. A picklist on the exam almost always hides a trap: multi-select picklists use `INCLUDES`/`EXCLUDES` in SOQL, not `=`.

## 2. Relationships and the Core Data Model

Relationships are stored as **foreign key fields** whose type is a *lookup to another object*. There are two relationship families:

| Type | Ownership | Cascade delete | Roll-up summaries | Notes |
|------|-----------|----------------|-------------------|-------|
| **Lookup** | none | no (orphan allowed) | no | optional parent; e.g., `Contact.AccountId` (a lookup even to Account) |
| **Master-Detail** | parent owns child | yes | yes (up to two *roll-up summary* levels) | child's OWD always controlled by parent; `IsDeleted` on child mirrors parent |

**Many-to-many** relationships are represented with a **junction object**: a custom object with two master-detail fields, one to each side (think `Training_Question__c` paired with `Study_Plan__c` via `Dev_Task__c`).

The Sales Cloud core you must be able to draw blindfolded:

```
Account (parent of Contact and Opportunity)
   ├─ 1:N  Contact        -> Contact.AccountId
   └─ 1:N  Opportunity    -> Opportunity.AccountId
```

Every `Opportunity` also has a `StageName` (picklist), `CloseDate` (date), and `Amount` (currency). Relationship names matter for SOQL: the *relationship name* is usually the object name pluralised—`Opportunities` and `Contacts` on `Account`. Queries navigate parent lookups with **dot notation** (`Account.Name`) and children with a **subquery** (`(SELECT Id FROM Opportunities)`).

## 3. First Reads and Writes: SOQL and DML

**SOQL** (Salesforce Object Query Language) is Salesforce's read language. A minimal query looks exactly like the repo's `scripts/soql/account.soql`:

```apex
List<Account> accounts = [SELECT Id, Name FROM Account];
```

Two relationship patterns you see in `DeveloperFundamentalsTest.cls` from day one:

```apex
// Parent lookup via dot notation: one statement, no second query
Contact ada = [SELECT FirstName, LastName, Account.Name FROM Contact LIMIT 1];
String parentName = ada.Account.Name; // 'Dev Roadmap Food Co'

// Child via subquery returns a List<SObject> on the parent
List<Account> withChildren = [
    SELECT Id, Name, (SELECT Id, FirstName FROM Contacts)
    FROM Account
    WHERE Id = :someAccountId
];
```

Phase 3 fully dissects SOQL; for now, remember the three structural keywords (`SELECT`, `FROM`, `WHERE`), the **bind variable** syntax (`:someAccountId`, which is injection-safe and always preferred over string concatenation), and that **there is no `SELECT *`**—you must name every field you need.

**DML** is the write language. This repo's `DeveloperFundamentalsTest.cls` performs every core operation:

```apex
Account acct = new Account(Name = 'Dev Roadmap Food Co');
insert acct;                      // DML statement

Contact mentor = new Contact(
    FirstName = 'Ada',
    LastName = 'Lovelace',
    AccountId = acct.Id           // set the parent relationship
);
insert mentor;

acct.Description = 'First contact mentor onboarded.';
update acct;

upsert acct;                      // insert or update depending on what exists
delete mentor;                    // moves to Recycle Bin
undelete mentor;                  // restores from Recycle Bin
```

Key rules the exam checks:

- **One DML statement can handle many records.** Always pass a `List`, never a loop of single inserts. The limit is 150 DML *statements* per transaction, not 150 records.
- `upsert sObject` matches on the standard `Id`; `upsert Account extField` matches on a custom **External ID** field you name. External IDs are how you avoid duplicate rows when syncing.
- **DML on lists is all-or-nothing by default**; the `Database` methods give you partial success (Phase 2).
- A record that does not exist yet has `Id == null` until the insert commits it.
- Once inserted, further changes go through the full **order of execution** (Phase 4): before triggers, validation, after triggers, workflow, flows, and so on.

## 4. System Context vs User Context and Sharing

Every Apex execution runs either in **user context** or **system context**, and the difference is one of the most-examined concepts on the developer exams.

**User context** means the running user (whoever clicked, whatever triggered the batch). Their profile/permission sets control **CRUD and FLS** (field-level security), and—when the class honours sharing—their record-level access (their sharing rules, team assignments, organization-wide defaults) filters every query and every DML operation. A user context SOQL that would return 1,000 rows to the admin may return 3 rows to a sales rep.

**System context** means the code bypasses the running user entirely. This is what happens:

- When an anonymous Apex block runs and `System.debug` executes without a declared sharing model,
- Inside a class declared `without sharing`,
- Inside **tests** (test methods run as system context by default unless they wrap logic in `System.runAs`).

System context sees all records the org can see, regardless of sharing; it still obeys **CRUD/FLS for the running user only in user context**—in pure system context, CRUD/FLS checks are also bypassed. That is why the security checks in `SecurityService.cls` (Phase 9) exist: never assume context gives you permission; describe-check it explicitly.

### Choosing a sharing model

The three keywords and their exact meaning:

| Keyword | Behaviour |
|---------|-----------|
| `public with sharing class X` | Enforces **record sharing** for the running user on all queries and DML in that class. |
| `public without sharing class X` | **Disables** record-sharing enforcement; runs as system context for sharing. |
| `public inherited sharing class X` | Inherits the sharing mode of the **caller**. Called from a `with sharing` class → sharing enforced; from `without sharing` → not enforced. Recommended default for reusable, caller-agnostic utility classes. |

Context is per-class, not per-stream: a `with sharing` class calling a `without sharing` class runs the callee without sharing, and vice versa. The exam loves this reverse-trap: `without sharing` does **not** bypass CRUD/FLS either—it only affects record sharing. A `with sharing` class never bypasses anything.

The general default for this lab and for real code: **`with sharing`** for anything that touches business records (all service classes here are declared `with sharing`), **`inherited sharing`** for generic utilities (see `TriggerHandlerService`), and **`without sharing` only when you consciously need system context** (for example `InboundRestService`, whose REST endpoints create audit logs for callers who may lack access—though even there, CRUD is re-checked explicitly).

## 5. Putting It Together in This Repo

Read `force-app/main/default/classes/DeveloperFundamentalsTest.cls` line by line. It demonstrates, in order:

1. `@TestSetup` creates one Account and one Contact shared by every test method (test-data isolation, Phase 9).
2. `insertionAndGuardActsOnIsolatedData` proves `SeeAllData` is false by default—the only visible Account is the one the test created.
3. `relationshipQueryAddressesTheParentAccount` shows a parent lookup via dot notation returning `Account.Name` with one query.
4. `limitsUtilsReflectTheTransactionShape` introduces the `Limits` API (`Limits.getQueries()` vs `Limits.getLimitQueries()`, i.e. the 100-query governor).

Run the test suite from the project root to confirm the foundation is sound:

```
sf apex run test -c
```

Then open a scratch org and poke at real data:

```
sf org create scratch -f config/project-scratch-def.json -a dev
sf project deploy start --source-dir force-app
sf apex run test -c
```

## 6. Common Exam Traps in This Phase

The first twenty questions of the PDI exam tend to probe fundamentals with surgical precision. The most recycled traps:

| Trap | Truth |
|------|-------|
| "`with sharing` prevents record access" | It *enforces* the running user's sharing; the user's own access is unchanged. |
| "System context bypasses FLS/CRUD checks" | System context bypasses *record sharing*, not CRUD/FLS semantics of the running user in user context. |
| "Custom object fields end with `__e`" | `__c` = custom object/field; `__e` = platform event; `__b` = big object. |
| "Delete is permanent" | `delete` moves to the Recycle Bin; `undelete` restores. `Database.emptyRecycleBin` is the permanent step. |
| "100 records per DML statement" | The 150-statement limit is *statements*, and rows are bounded by 10,000 per transaction. |
| "`upsert` needs an External ID" | `upsert record` matches on standard `Id`; an External ID is only required when you name one explicitly. |
| "A lookup is required to relate one record to another" | A lookup is optional; a master-detail relationship is what cascades deletion. |
| "`SELECT *` works in SOQL" | There is no star; every field must be requested explicitly. |

Reading strategy for these: **identify the keyword** ("without sharing", "external", "recycle bin", "master-detail") before the explanation. That keyword, not the sentence, carries the intended answer.

## Hands-On Exercises

### Exercise 1: Query the core data model

1. Open the `scripts/soql/account.soql` file and execute `SELECT Id, Name FROM Account` with "SFDX: Execute SOQL Query".
2. Modify it to pull the parent relationship: `SELECT Id, Name, (SELECT Id, FirstName, LastName FROM Contacts) FROM Account LIMIT 10`.
3. Add a `WHERE` with a bind: `WHERE Health_Score__c >= 70 ORDER BY Health_Score__c DESC`.
4. Note how the chance of zero records behaves: a missing field name throws a compile-time error, a wrong object name throws at query time.

### Exercise 2: DML round trip in Apex

1. In the Developer Console or an anonymous Apex script (`scripts/apex/hello.apex`), build three `Account` records in a list and insert them in ONE statement.
2. Read them back with one SOQL; print `Limits.getDmlStatements()` and `Limits.getLimitDmlStatements()`.
3. `upsert` the list back using the standard Id; then `delete` one record and `undelete` it.
4. Confirm a record is moved to the Recycle Bin after delete: `SELECT Id, Name FROM Account WHERE IsDeleted = true ALL ROWS`.

### Exercise 3: Sharing-model smoke test

1. Create two classes: one `public with sharing class A`, one `public without sharing class B`, each with `public static Integer countAccounts()` returning `[SELECT COUNT() FROM Account]`.
2. From an anonymous block, `System.debug('with=' + A.countAccounts() + ' without=' + B.countAccounts());` as an admin—both return the same number because admin sees everything.
3. Deploy, log in as a low-privilege user, and re-run to observe the sharing-model difference in action.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Org** | A customer's configured multitenant Salesforce environment containing metadata and data. |
| **Object** | A table of data exposed by the platform; standard (Account, Opportunity) or custom (`__c`). |
| **Field** | A column/attribute of an object with a data type such as Text, Number, or Lookup. |
| **Record** | A single row of an object with concrete field values. |
| **Relationship** | A foreign-key linkage; lookup (optional) or master-detail (owned) relationships. |
| **SOQL** | Salesforce Object Query Language—the read language for retrieving records. |
| **DML** | Data Manipulation Language; `insert`, `update`, `upsert`, `delete`, `undelete`. |
| **Upsert** | Insert-or-update matched by a standard Id or a named External ID field. |
| **User context** | Code running as the logged-in user, honouring their CRUD/FLS and (if sharing enabled) record access. |
| **System context** | Code bypassing record-sharing enforcement (e.g. `without sharing`, tests, anonymous Apex). |
| **`with sharing`** | Class keyword enforcing the running user's record-sharing rules on queries/DML. |
| **`inherited sharing`** | Class keyword inheriting the caller's sharing mode; safe default for utilities. |
| **Multitenant** | Shared infrastructure where data isolation, governors, and metadata are platform-enforced. |

## Certification Checkpoints

- [ ] I can name the three relationship types (lookup, master-detail, junction) and one repo example of each.
- [ ] I can draw Account → Contact → Opportunity with the correct lookup field on each child.
- [ ] I can write `SELECT`/`WHERE`/`ORDER BY`/`LIMIT` queries without looking anything up.
- [ ] I can explain why `List<Account> accts = [SELECT Id FROM Account]; insert new Contact(AccountId = accts[0].Id);` needs no second query.
- [ ] I know the exact syntactic difference between `insert`/`database insert` and when partial-success matters.
- [ ] I can state what `with sharing`, `without sharing`, and `inherited sharing` each do and what they never do.
- [ ] I have run `sf apex run test -c` and seen the Developer Fundamentals tests pass.