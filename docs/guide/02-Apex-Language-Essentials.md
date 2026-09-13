# Phase 2: Apex Language Essentials

Apex is the exam's core language: typed, governed, and object-oriented. This phase covers the building blocks—primitives, collections, sObjects, control flow, classes, exceptions, and visibility—that every other phase assumes.

## Learning Objectives

By the end of this phase, you will be able to:
- Declare and manipulate the primitive Apex data types and choose the right numeric type.
- Build and traverse `List`, `Set`, and `Map` collections, including the `Map<Id, sObject>` retrieval pattern.
- Difference between sObjects (typed records) and collections of primitives.
- Write control flow including the Apex `switch` and loop over collections safely.
- Define classes with methods, constructors, inner classes, enums, and correct access modifiers.
- Throw and catch built-in and custom exceptions.
- Contrast `insert` vs `Database.insert` and understand their error semantics.

## 1. Primitive Data Types

Apex has a small set of primitives, all declared with the data type then a name, ending with a semicolon:

```apex
String name = 'Ada Lovelace';
Integer count = 42;          // 32-bit signed, no decimal
Long big = 123456789012345L; // 64-bit
Double d = 3.14159;          // 64-bit floating point
Decimal money = 29.99;       // 128-bit, exact, for currency
Boolean done = true;
Date today = Date.today();   // calendar date only
Datetime now = System.now(); // date + time
Time t = Time.newInstance(9, 15, 0, 0);
Id accountId = '001000000000001';
Blob data = Blob.valueOf('bytes');
Object polymorphic = 'anything';
```

The traps that repeatedly appear:

- **Integer vs Long**: `Integer` max ~2.1 billion; use `Long` for arithmetic that can exceed it.
- **Double vs Decimal**: `Double` is binary floating point (imprecise for money); `Decimal` is exact and used for currency/percent. The `LIMIT`/`OFFSET` numbers in SOQL are Integers.
- **Id is a real type**, case-insensitive, always 15 or 18 characters. `Id` values compare equal ignoring case.
- **String immutability**: every `String` operation returns a new String; see `String.escapeSingleQuotes()`, `.trim()`, `.left(n)`, `.isBlank()` in the repo services.
- **Date vs Datetime**: an unqualified `Date.today()` compares only the date; `Datetime` includes timezone-sensitive time.
- `Blob`, `Object`, and `sObject` are technically classes, not primitives, but appear in "type" questions constantly.

## 2. Collections: List, Set, Map

### List

An ordered, indexable collection of a single element type:

```apex
List<Account> accounts = new List<Account>();
accounts.add(new Account(Name = 'A'));
accounts.add(new Account(Name = 'B'));
String firstName = accounts[0].Name;
Integer size = accounts.size();
accounts.remove(0);
```

Lists are the natural container for SOQL results and DML batches. The exam's favourite list questions are about **bulkifying** (one list, not one record in a loop) and indexing (`accounts[0]`, watch for `NoSuchElementException`).

### Set

An unordered, unique-element collection:

```apex
Set<Id> accountIds = new Set<Id>();
accountIds.add(acc.Id);
Boolean has = accountIds.contains(acc.Id);  // O(1)
```

Sets power the "collect Ids then query IN :set" pattern and recursion guards (Phase 4).

### Map

Key-value storage where keys are unique:

```apex
Map<Id, Account> accountsById = new Map<Id, Account>([SELECT Id, Name FROM Account]);
Account a = accountsById.get(acc.Id);
Boolean exists = accountsById.containsKey(acc.Id);
```

The single most useful Apex idiom in the certification is **`Map<Id, sObject>` built from a query**—it gives you O(1) lookups and makes SOQL-in-a-loop unnecessary. `PerformanceService.slotContactsByAccount` (Phase 10) is the canonical example. Note also `Map<Id, List<Contact>>` for grouping by a key, which turns an O(n*m) nested loop into an O(n+m) map join.

Iteration pattern to internalise:

```apex
for (Id accId : accountsById.keySet()) { /* ... */ }
for (Account acc : accountsById.values()) { /* ... */ }
```

Maps with sObject keys use field values like `Name`—useful for deduplication (`new Map<Account, Boolean>`), a pattern the exam asks about for `upsert`-by-external-key scenarios.

## 3. sObject Types and Records

An **sObject** is a typed record reference. You construct one, set fields either with dot notation or the dynamic `put()`, and read fields either way:

```apex
Account a = new Account();
a.Name = 'New Name';
a.put('Health_Score__c', 88);

Account b = new Account(Name = 'Alt', Health_Score__c = 92);
Object score = b.get('Health_Score__c');
```

`sObject` (with a lowercase 'o' in `SObject`/`sObject`) is the base type for all objects; `SObject` is the exact class name used in generic signatures like `List<SObject>`. This distinction shows up in type questions:

- `List<Account>` is typed; `List<SObject>` is generic.
- `Security.stripInaccessible(...)` returns a `SObjectAccessDecision` whose `getRecords()` returns `List<SObject>`.
- SOQL child subqueries arrive as `List<SObject>`.

`sObject` also names the runtime token form for describes: `Schema.SObjectType.Account` and the field token `Schema.SObjectType.Account.fields.Health_Score__c` (used everywhere in `SecurityService`).

## 4. Control Flow and Operators

Almost everything in Apex looks like Java-minus-onions:

```apex
if (score >= 70) {
    // pass
} else if (score >= 50) {
    // retake
} else {
    // fail
}

for (Integer i = 0; i < 10; i++) { System.debug(i); }
for (Account acc : accounts) { /* enhanced for */ }
for (Integer i : new List<Integer>{1, 2, 3}) { /* over elements */ }

Integer x = 0;
while (x < 5) { x++; }
do { x--; } while (x > 0);
```

The modern **switch** on an expression:

```apex
switch on stage {
    when 'Prospecting' { system.debug('early'); }
    when 'Closed Won' { system.debug('won'); }
    when else { system.debug('other'); }
}
```

The exam's operator traps:

- **`==` compares by value for primitives and Strings, by reference for objects** unless the object implements equality—two separate `Account` records with identical names are *not* `==`. This is Apex question folklore; almost nobody expects it.
- **`!=` and `==` on Strings**: exact, case-sensitive matching.
- **Safe navigation is not Apex**—there is no `?.`. A null `acc.Account` member access throws `System.NullPointerException`. Guard nothing, crash everything, or use `?.`—there is no operator; check with `!= null`.
- `&&` short-circuits; `||` too.
- Watch Enum comparison with `==` (enums compare by value, fine) and the `switch on` enum form.

## 5. Classes, Methods, and Constructors

An Apex class groups state and behaviour. The repo's `IntegrationService` is a fine model: `public with sharing class IntegrationService` with `public static` entry points, an inner `CalloutResult` class for the typed return, constants, and a nested exception.

```apex
public class Greeter {
    private final String prefix;              // final instance field

    public Greeter(String prefix) {            // constructor
        this.prefix = prefix;                  // this disambiguates the parameter
    }

    public String greet(String name) {
        return prefix + ', ' + name;
    }
}
// usage
Greeter g = new Greeter('Hello');
String msg = g.greet('Ada');
```

Essentials the assessment assumes:

- **Methods** are `returnType name(args)`. Overloading (two same-named methods with different signatures) is legal.
- **Static methods** belong to the class, no instance required: `PerformanceService.rebuildHealthScores(...)`, all the `*Service` entry points.
- **Instance methods** require `new` first.
- **Constructors** run on `new`; a class with no explicit constructor gets a default parameterless one; calling another constructor from a constructor requires `this(...)` syntax.
- **`this`** refers to the current instance; used when a parameter name collides with a field (`this.monitorId = monitorId` in `MonitorQueueable`).
- **Inner classes** (`public class QuizOutcome { public Integer correct; }` in `CertificationPrepService`; `CalloutResult` in `IntegrationService`) are full utility classes scoped to the outer class. Useful for DTO records that cluster a response.
- **Enums** define a named set of constants: `public enum SecurityAccess { READ, CREATE, UPDATE, DELETE }` in `SecurityService`, consumed by a `switch on access`. Exam-grade detail: you can iterate `SecurityAccess.values()` and convert with `.name()`/`valueOf(...)`.

## 6. Access Modifiers and Visibility

Apex supports four levels, and the rule for `global` is strict: you only need `global` when something is called *outside the org boundary*—REST resources, `@AuraEnabled` methods, and classes referenced in packages.

| Modifier | Visible to | Typical use |
|----------|-----------|-------------|
| `private` | the class itself | helpers, inner implementations |
| `protected` | class + subclasses | framework extension points |
| `public` | everyone in the org | normal service methods, test access |
| `global` | everyone including external callers (REST, Aura, packages) | `@RestResource` + `@Http*` methods, `@AuraEnabled` |

Notes: **a class whose members are `public` also allows subclassing outside the package only if `global`**; Aura/REST annotations force `global` (see `InboundRestService`: `global with sharing class ...` with `global static void doGet()`). Methods are virtual by default? No—**methods are `virtual` only if you write `virtual` or `override`**; otherwise non-virtual and uninheritable? In Apex, methods are virtual only if declared `virtual`; a subclass method must declare `override` to match one. `abstract` classes can't be instantiated. Also careful: **Apex has no `default` access modifier—omitting a modifier means `private`**, a permanent source of compile errors for newcomers from Java.

`static` vs instance: `static` members are shared across the class, persist for the whole transaction (that's how `TriggerHandlerService.processedExternalIds` survives across trigger invocations), and have no `this`.

## 7. Exceptions and Custom Exceptions

Apex has a built-in exception hierarchy rooted at `Exception`. Common caught types: `System.NullPointerException`, `System.QueryException` (bad SOQL, including "query returned no rows for aggregate"), `System.DmlException` (bulk-DML failures), `System.CalloutException` (network failure), `System.LimitException`, `System.NoSuchElementException`, and `System.TypeException` (failed casts/`Integer.valueOf` of junk).

The canonical pattern:

```apex
try {
    IntegrationService.CalloutResult outcome =
        IntegrationService.callOutbound('GET', '/health', null);
} catch (CalloutException e) {
    // network-level failure
} catch (Exception e) {          // always last; broad catch
    System.debug(e.getMessage());
} finally {
    // runs unconditionally
}
```

**Custom exceptions** are one-liners that subclass the system-provided `Exception` base:

```apex
public class CalloutLimitExceededException extends Exception {}
public class SecurityAccessDeniedException extends Exception {}
public class ValidationFailedException extends Exception {}
```

(These three live in `IntegrationService`, `SecurityService`, and `InboundRestService` respectively.) Throw them with `throw new ...Exception('user-meaningful message');`. The exam wants you to explain why custom exceptions matter: they let callers `catch` a domain-specific failure without string-matching messages and they carry their own class as an unambiguous signal that the flow was intentional, not accidental.

**Guaranteed exception semantics:** a DML failure on an all-or-nothing DML *statement* throws `DmlException` and rolls back the entire transaction request; the `Database.*` methods (next section) let you choose partial success. Both can be inspected per record via `exception.getDmlFields(i)`, `.getDmlMessage(i)`, etc.

## 8. `insert` vs `Database.insert` and DML Error Handling

Every DML operation has two spellings that behave differently under failure:

| Aspect | DML statement `insert myList;` | `Database.insert(myList, false);` |
|--------|-------------------------------|-----------------------------------|
| On failure | throws `DmlException`, whole list rolls back | no throw; returns `Database.SaveResult[]`, one result per record |
| Partial success | never | partial records are saved when `allOrNothing` is `false` |
| Result inspection | you catch the exception | loop the `SaveResult`: `.isSuccess()`, `.getId()`, `.getErrors()` |
| Records processed | stops at first problem | continues over the whole list |

```apex
List<Integration_Log__c> logs = new List<Integration_Log__c>{ /* ... */ };
Database.SaveResult[] results = Database.insert(logs, false);

Integer failures = 0;
for (Database.SaveResult r : results) {
    if (!r.isSuccess()) {
        failures++;
        for (Database.Error err : r.getErrors()) {
            System.debug(err.getMessage());
        }
    }
}
```

The complete set of `Database` methods parallel the statement verbs: `Database.insert`, `update`, `upsert`, `delete`, `undelete`, plus `Database.emptyRecycleBin` (not the same as delete!), `Database.query` (dynamic SOQL), `Database.getQueryLocator` (Phase 5), and `Database.executeBatch` (Phase 5). `EventBus.publish` also returns `List<Database.SaveResult>`—the same success/error contract, which is why `EventPublisherService` inspects results.

The exam pair-to-remember: `upsert` without an external ID or on a non-External-ID field throws a compile error; `upsert recordList Ext_Field__c` matches on that field. Options on partial failure (`Database.update(list, false)`) vs throwing (`Database.update(list, true)`).

## 9. Apex Quick Reference Patterns

Beyond syntax, the exam wants you fluent in the *idioms* the platform's own tooling emits. Here is the pocket reference:

```apex
// Bulk pattern: collect-then-act
List<Account> toUpdate = new List<Account>();
for (Account acc : [SELECT Id, Name FROM Account]) {
    acc.Health_Score__c = acc.Health_Score__c == null ? 70 : acc.Health_Score__c;
    toUpdate.add(acc);
}
update toUpdate;                                  // ONE statement

// Map from query (O(1) lookups)
Map<Id, Account> byId = new Map<Id, Account>([SELECT Id, Name FROM Account]);

// Safe dynamic query
List<Account> hits = Database.query(
    'SELECT Id FROM Account WHERE Name LIKE :' + String.escapeSingleQuotes(term)
);                                               // NEVER concatenate user input raw

// Guarded null walking
String parentName = acc.Account?.Name;            // NBT: Apex has NO ?. — check before access
```

Two style points the platform scores you on: **always branch on nulls before accessing nested fields** (dot-null → `NullPointerException`), and **cast conservatively** when reading `Object`/generic values (`(Integer) row.get('count')`, `(Decimal) obj`). Forgetting the cast is a second-nature exam error.

## 10. Ambient Topics PDII Adds

PDII's Advanced Developer Fundamentals domain leans on language details that squeeze into code-analysis questions:

- **`virtual`/`abstract`/`override` and `final`** — a `final` class or method can't be extended/overridden; abstract classes force `abstract` method overrides in non-abstract subclasses.
- **Interfaces** — `implements` lists; an interface method is implicitly `public/virtual`; classes can implement several interfaces.
- **`System.Type`/`Type.forName`** — runtime type lookup used by dynamic patterns (`Type.forName('Account').newInstance()`).
- **`switch` on `sObject` type** — `switch on sObj { when Account a { ... } when else { ... } }`, an exam-styled runtime dispatch.
- **`put()`/`get()` vs dot access** — dynamic field names (`record.put('Name', x)`, `String.valueOf(record.get('Name'))`) are how reflection-style code mutates unknown objects; remember they bypass compile-time field typing.

## Hands-On Exercises

### Exercise 1: Collections and maps in anonymous Apex

1. From a scratch org, build three Accounts in a list and insert them in one statement.
2. Construct `Map<Id, Account>` directly from the query results.
3. Iterate to print `acc.Name` for every key, then demonstrate `containsKey` and `get` semantics for a bogus Id.
4. Convert the map back to `values()` and note the order is not guaranteed.

### Exercise 2: Build a typed DTO with an inner class

1. Create `AccountSummaryScore` with public fields in `dev/…/classes`.
2. Give it a constructor that takes an `Account` and copies `Name` + `Health_Score__c`.
3. In anonymous Apex, map five Accounts into `List<AccountSummaryScore>` and `System.debug` the results.

### Exercise 3: Custom exception round trip

1. Edit `IntegrationService` locally: call `callOutbound('POST', '/health', '{"ping":1}')` from anonymous Apex until `Limits.getLimitCallouts()` is reached.
2. Catch `IntegrationService.CalloutLimitExceededException` explicitly in a `try` and print its message.
3. Swap to a `catch (Exception e)` and observe the same message flowing up the hierarchy.

### Exercise 4: Partial vs all-or-nothing DML

1. Build a list containing one valid and one invalid record (e.g., an `Opportunity` with a `Name` longer than the 120-char max, or a missing required field).
2. `Database.insert(list, false)` and print each `SaveResult.isSuccess()`.
3. Repeat with `insert list;` and catch the `DmlException`, noting the total rollback behaviour.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Primitive** | A built-in value type: Integer, Long, Double, Decimal, String, Boolean, Date, DateTime, Time, Id, Blob, Object. |
| **List** | Ordered, indexable collection; the natural container for SOQL rows and DML batches. |
| **Set** | Unordered collection of unique elements; fast `contains` checks and `IN :set` filters. |
| **Map** | Key-value collection with unique keys; `Map<Id, sObject>` enables O(1) lookups. |
| **sObject** | Typed record reference; `SObject` is the generic base type name. |
| **`this`** | Reference to the current object instance; disambiguates constructor/field names. |
| **Static** | Belongs to the class, shared per transaction, persists across trigger invocations. |
| **Enum** | Named set of constants; `SecurityAccess.READ` is an enum value with `.name()`/`.valueOf()`. |
| **Inheritance modifier** | `virtual`, `override`, `abstract` control subclass behaviour; methods are not virtual by default. |
| **`global`** | Visibility required for cross-org exposure: REST, `@AuraEnabled`, packaged code. |
| **Custom exception** | `class X extends Exception {}`; thrown to signal domain-specific failures cleanly. |
| **`Database.SaveResult`** | Per-record DML outcome from partial-success `Database.*` calls. |

## Certification Checkpoints

- [ ] I can explain why two identical `Account` objects are `!=` under `==` but equal Strings are `==`.
- [ ] I know the exact `Map<Id, sObject>( [SOQL] )` constructor pattern and its speed payoff.
- [ ] I can write a `switch on` statement over an enum.
- [ ] I can name the three custom exception classes defined in this repo and where each lives.
- [ ] I can contrast `Database.insert(list, false)` with `insert list` and state which returns SaveResults.
- [ ] I can list which modifiers force `global` (REST, Aura) and which force static (REST/Aura methods).
- [ ] I can trace through `while`, `for`, `for-in`, and `do-while` for a simple counter and predict the result.