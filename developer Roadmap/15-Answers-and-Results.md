# Phase 15: Answers and Results

Complete solutions for every exercise and mini project in `14-Practical-Exercises-and-Mini-Projects.md`. Each answer includes working code, expected output, and common mistakes to avoid.

---

## Section 1: Developer Fundamentals & Apex Basics (Phases 1–2)

### Exercise 1.1 — SOQL Parent-Child Query

**Anonymous Apex script:**

```apex
// Step 1: Create 3 Accounts
List<Account> accounts = new List<Account>{
    new Account(Name = 'Alpha Corp', Health_Score__c = 50),
    new Account(Name = 'Beta Inc', Health_Score__c = 75),
    new Account(Name = 'Gamma LLC', Health_Score__c = 90)
};
insert accounts;

// Step 2: Create Contacts
List<Contact> contacts = new List<Contact>{
    new Contact(FirstName = 'Ada', LastName = 'Lovelace', AccountId = accounts[0].Id),
    new Contact(FirstName = 'Grace', LastName = 'Hopper', AccountId = accounts[0].Id),
    new Contact(FirstName = 'Alan', LastName = 'Turing', AccountId = accounts[1].Id)
};
insert contacts;

// Step 3: Parent with child subquery
List<Account> accountsWithContacts = [
    SELECT Id, Name, Health_Score__c,
        (SELECT Id, FirstName, LastName FROM Contacts)
    FROM Account
    ORDER BY Name
];

Integer totalContacts = 0;
for (Account acc : accountsWithContacts) {
    System.debug(acc.Name + ' has ' + acc.Contacts.size() + ' contacts');
    totalContacts += acc.Contacts.size();
}
System.debug('Total contacts: ' + totalContacts);  // Expected: 3

// Step 4: Child with parent dot notation
List<Contact> allContacts = [
    SELECT Id, FirstName, LastName, Account.Name
    FROM Contact
    ORDER BY Account.Name
];
for (Contact c : allContacts) {
    System.debug(c.FirstName + ' ' + c.LastName + ' → ' + c.Account.Name);
}

// Step 5: Verify SOQL count
System.debug('SOQL statements used: ' + Limits.getQueries());  // Expected: 2
```

**Expected debug output:**
```
Alpha Corp has 2 contacts
Beta Inc has 1 contacts
Gamma LLC has 0 contacts
Total contacts: 3
Ada Lovelace → Alpha Corp
Grace Hopper → Alpha Corp
Alan Turing → Beta Inc
SOQL statements used: 2
```

**Common mistakes:**
- Forgetting to set `AccountId` on Contact records before insert.
- Using `SELECT *` (does not exist in SOQL).
- Running queries inside the `for` loop (use subquery or single query outside).

---

### Exercise 1.2 — DML Round Trip with Limits Tracking

```apex
// Step 1: Insert 5 accounts in ONE statement
List<Account> accounts = new List<Account>{
    new Account(Name = 'DML Test 1', Health_Score__c = 60),
    new Account(Name = 'DML Test 2', Health_Score__c = 70),
    new Account(Name = 'DML Test 3', Health_Score__c = 80),
    new Account(Name = 'DML Test 4', Health_Score__c = 90),
    new Account(Name = 'DML Test 5', Health_Score__c = 100)
};
insert accounts;
System.debug('After insert — DML statements: ' + Limits.getDmlStatements());

// Step 2: Read them back
List<Account> retrieved = [SELECT Id, Name, Health_Score__c FROM Account WHERE Name LIKE 'DML Test%'];
System.debug('Retrieved: ' + retrieved.size());  // 5

// Step 3: Modify 3 records
retrieved[0].Health_Score__c = 55;
retrieved[1].Health_Score__c = 65;
retrieved[2].Health_Score__c = 75;
update retrieved;
System.debug('After update — DML statements: ' + Limits.getDmlStatements());

// Step 4: Upsert all 5
upsert accounts;
System.debug('After upsert — DML statements: ' + Limits.getDmlStatements());

// Step 5: Delete 2 records
Account toDelete1 = accounts[3];
Account toDelete2 = accounts[4];
delete new List<Account>{toDelete1, toDelete2};
System.debug('After delete — DML statements: ' + Limits.getDmlStatements());

// Step 6: Undelete one
undelete toDelete1;
System.debug('After undelete — DML statements: ' + Limits.getDmlStatements());

// Step 7: Query deleted records
List<Account> deletedAccounts = [SELECT Id, Name FROM Account WHERE IsDeleted = true ALL ROWS];
System.debug('Deleted accounts: ' + deletedAccounts.size());

// Final summary
System.debug('=== FINAL DML STATEMENT COUNT: ' + Limits.getDmlStatements() + ' of ' + Limits.getLimitDmlStatements() + ' ===');
```

**Expected result:**
- 5 DML statements used (insert, update, upsert, delete, undelete).
- ALL ROWS query adds 1 more (6 total if counting the final SOQL as DML).
- 1 deleted record restored, 1 remains in recycle bin.

**Common mistakes:**
- Using separate `delete toDelete1; delete toDelete2;` instead of one `delete` with a list.
- Forgetting `ALL ROWS` on the recycle bin query.

---

### Exercise 1.3 — Collections: List, Set, Map

```apex
// Step 1: Insert 10 accounts
List<Account> accounts = new List<Account>();
for (Integer i = 1; i <= 10; i++) {
    accounts.add(new Account(Name = 'Collection Test ' + i, Health_Score__c = i * 10));
}
insert accounts;

// Step 2: Build Set of Ids
Set<Id> accountIds = new Set<Id>();
for (Account acc : [SELECT Id FROM Account WHERE Name LIKE 'Collection Test%']) {
    accountIds.add(acc.Id);
}
System.debug('Set size: ' + accountIds.size());  // 10

// Step 3: Build Map from query (THE key pattern)
Integer cpuBefore = Limits.getCpuTime();
Map<Id, Account> accountsById = new Map<Id, Account>(
    [SELECT Id, Name, Health_Score__c FROM Account WHERE Name LIKE 'Collection Test%']
);
Integer cpuAfter = Limits.getCpuTime();
System.debug('Map build CPU: ' + (cpuAfter - cpuBefore) + ' ms');
System.debug('Map size: ' + accountsById.size());  // 10

// Step 4: Iterate keySet
for (Id accId : accountsById.keySet()) {
    Account acc = accountsById.get(accId);
    System.debug(acc.Name + ' → Score: ' + acc.Health_Score__c);
}

// Step 5: containsKey demo
Id validId = accounts[0].Id;
Id bogusId = '001000000000000';
System.debug('containsKey(valid): ' + accountsById.containsKey(validId));   // true
System.debug('containsKey(bogus): ' + accountsById.containsKey(bogusId));   // false

// Step 6: Convert back to List
List<Account> asList = accountsById.values();
System.debug('values() size: ' + asList.size());  // 10
// Note: order is NOT guaranteed

// Step 7: Final CPU
System.debug('Total CPU used: ' + Limits.getCpuTime() + ' ms');
```

**Expected result:**
```
Set size: 10
Map build CPU: ~0 ms
Map size: 10
containsKey(valid): true
containsKey(bogus): false
values() size: 10
```

---

### Exercise 1.4 — Sharing Model Smoke Test

**SharingTestA.cls:**
```apex
public with sharing class SharingTestA {
    public static Integer countAccounts() {
        return [SELECT COUNT() FROM Account];
    }
}
```

**SharingTestB.cls:**
```apex
public without sharing class SharingTestB {
    public static Integer countAccounts() {
        return [SELECT COUNT() FROM Account];
    }
}
```

**SharingModelTest.cls:**
```apex
@isTest
private class SharingModelTest {

    @TestSetup
    static void makeData() {
        // Create accounts visible to admin
        List<Account> accts = new List<Account>{
            new Account(Name = 'Admin Account 1'),
            new Account(Name = 'Admin Account 2'),
            new Account(Name = 'Admin Account 3')
        };
        insert accts;

        // Create a low-privilege user
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User lowPriv = new User(
            FirstName = 'Low',
            LastName = 'Privilege',
            Email = 'lowpriv@test.com',
            Username = 'lowpriv' + System.currentTimeMillis() + '@test.com',
            Alias = 'lowp',
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            ProfileId = standardProfile.Id
        );
        insert lowPriv;
    }

    @isTest
    static void withSharingEnforcesRecordAccess() {
        User lowPriv = [SELECT Id FROM User WHERE LastName = 'Privilege' LIMIT 1];

        System.runAs(lowPriv) {
            Integer withSharingCount = SharingTestA.countAccounts();
            Integer withoutSharingCount = SharingTestB.countAccounts();

            // Admin created accounts but low-priv user has no access
            // with sharing should see fewer (or zero) than without sharing
            System.assert(withSharingCount <= withoutSharingCount,
                'with sharing should see same or fewer records');

            System.debug('with sharing: ' + withSharingCount);
            System.debug('without sharing: ' + withoutSharingCount);
        }
    }
}
```

**Expected result:**
- Admin: both classes return the same count.
- Low-priv user: `with sharing` returns 0 (or fewer), `without sharing` returns all.

---

### Exercise 1.5 — Partial vs All-or-Nothing DML

```apex
// Build mixed-validity list
List<Account> records = new List<Account>{
    new Account(Name = 'Valid Account 1'),
    new Account(Name = 'Valid Account 2'),
    new Account(Name = 'Valid Account 3'),
    new Account(Name = 'X'.repeat(260))  // exceeds 255 char limit
};

// Test 1: Partial DML (allOrNothing = false)
Database.SaveResult[] results = Database.insert(records, false);
Integer successes = 0;
Integer failures = 0;
for (Database.SaveResult r : results) {
    if (r.isSuccess()) {
        successes++;
    } else {
        failures++;
        for (Database.Error err : r.getErrors()) {
            System.debug('Error: ' + err.getMessage());
        }
    }
}
System.debug('Partial DML — Successes: ' + successes + ', Failures: ' + failures);
// Expected: Successes: 3, Failures: 1

// Test 2: All-or-nothing DML
List<Account> records2 = new List<Account>{
    new Account(Name = 'AllOrNothing 1'),
    new Account(Name = 'AllOrNothing 2'),
    new Account(Name = 'X'.repeat(260))
};

DmlException caught = null;
try {
    insert records2;
} catch (DmlException e) {
    caught = e;
}
System.assert(caught != null, 'DmlException should be thrown');
System.debug('All-or-nothing threw: ' + caught.getMessage());

// Verify: no records were saved
List<Account> saved = [SELECT Id FROM Account WHERE Name LIKE 'AllOrNothing%'];
System.assertEquals(0, saved.size(), 'All-or-nothing should have rolled back all records');
```

**Expected result:**
```
Partial DML — Successes: 3, Failures: 1
All-or-nothing threw: Required fields are missing: [Name]
```

---

### Exercise 1.6 — Custom Exception

**AccountValidationException.cls:**
```apex
public class AccountValidationException extends Exception {}
```

**Anonymous Apex:**
```apex
public static void validateAccount(Account a) {
    if (a.Name == null || a.Name.trim() == '') {
        throw new AccountValidationException('Account Name cannot be blank');
    }
    if (a.Health_Score__c != null && (a.Health_Score__c < 0 || a.Health_Score__c > 100)) {
        throw new AccountValidationException('Health Score must be 0-100, got: ' + a.Health_Score__c);
    }
}

// Test 1: Blank name
try {
    validateAccount(new Account(Name = ''));
} catch (AccountValidationException e) {
    System.debug('Caught: ' + e.getMessage());  // "Account Name cannot be blank"
}

// Test 2: Score out of range
try {
    validateAccount(new Account(Name = 'Test', Health_Score__c = 150));
} catch (AccountValidationException e) {
    System.debug('Caught: ' + e.getMessage());  // "Health Score must be 0-100, got: 150"
}

// Test 3: Valid account
try {
    validateAccount(new Account(Name = 'Valid Corp', Health_Score__c = 75));
    System.debug('Valid');
} catch (AccountValidationException e) {
    System.debug('Should not reach here');
}
```

**Expected output:**
```
Caught: Account Name cannot be blank
Caught: Health Score must be 0-100, got: 150
Valid
```

---

### Mini Project 1: Account Health Management Service

**AccountHealthService.cls:**
```apex
public with sharing class AccountHealthService {

    public static List<Account> getAccountsByMinScore(Integer minScore) {
        if (minScore == null) minScore = 0;
        return [
            SELECT Id, Name, Health_Score__c, Industry
            FROM Account
            WHERE Health_Score__c >= :minScore
            ORDER BY Health_Score__c DESC
        ];
    }

    public static Map<Id, Account> buildAccountMap(List<Id> accountIds) {
        if (accountIds == null || accountIds.isEmpty()) {
            return new Map<Id, Account>();
        }
        return new Map<Id, Account>(
            [SELECT Id, Name, Health_Score__c FROM Account WHERE Id IN :accountIds]
        );
    }

    public static void normalizeScores(List<Account> accounts) {
        for (Account acc : accounts) {
            if (acc.Health_Score__c == null) {
                acc.Health_Score__c = 70;
            } else if (acc.Health_Score__c < 0) {
                acc.Health_Score__c = 0;
            } else if (acc.Health_Score__c > 100) {
                acc.Health_Score__c = 100;
            }
        }
    }

    public static void bulkUpdateScores(Map<Id, Integer> scoreUpdates) {
        if (scoreUpdates == null || scoreUpdates.isEmpty()) return;

        List<Id> ids = new List<Id>(scoreUpdates.keySet());
        Map<Id, Account> accountsById = buildAccountMap(ids);

        List<Account> toUpdate = new List<Account>();
        for (Id accId : scoreUpdates.keySet()) {
            Account acc = accountsById.get(accId);
            if (acc != null) {
                acc.Health_Score__c = scoreUpdates.get(accId);
                toUpdate.add(acc);
            }
        }
        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }
    }

    public static Integer calculateAverageScore(List<Account> accounts) {
        if (accounts == null || accounts.isEmpty()) return 0;

        Decimal total = 0;
        Integer count = 0;
        for (Account acc : accounts) {
            if (acc.Health_Score__c != null) {
                total += acc.Health_Score__c;
                count++;
            }
        }
        return count == 0 ? 0 : (Integer)(total / count);
    }
}
```

**AccountHealthServiceTest.cls:**
```apex
@isTest
private class AccountHealthServiceTest {

    @TestSetup
    static void makeData() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 10; i++) {
            accounts.add(new Account(
                Name = 'Health Test ' + i,
                Health_Score__c = i * 10  // 0, 10, 20, ... 90
            ));
        }
        insert accounts;
    }

    @isTest
    static void getAccountsByMinScoreReturnsCorrectSubset() {
        List<Account> result = AccountHealthService.getAccountsByMinScore(50);
        System.assertEquals(5, result.size(), 'Should return 5 accounts with score >= 50');
        System.assert(result[0].Health_Score__c >= result[1].Health_Score__c, 'Should be ordered DESC');
    }

    @isTest
    static void getAccountsByMinScoreNullReturnsAll() {
        List<Account> result = AccountHealthService.getAccountsByMinScore(null);
        System.assertEquals(10, result.size());
    }

    @isTest
    static void buildAccountMapReturnsMapById() {
        List<Account> allAccts = [SELECT Id FROM Account];
        Set<Id> ids = new Map<Id, Account>(allAccts).keySet();
        Map<Id, Account> result = AccountHealthService.buildAccountMap(new List<Id>(ids));
        System.assertEquals(10, result.size());
    }

    @isTest
    static void buildAccountMapEmptyInputReturnsEmptyMap() {
        Map<Id, Account> result = AccountHealthService.buildAccountMap(new List<Id>());
        System.assertEquals(0, result.size());
    }

    @isTest
    static void normalizeScoresClampsValues() {
        List<Account> testAccounts = new List<Account>{
            new Account(Name = 'Null Score'),
            new Account(Name = 'Too High', Health_Score__c = 150),
            new Account(Name = 'Too Low', Health_Score__c = -10),
            new Account(Name = 'Just Right', Health_Score__c = 75)
        };

        AccountHealthService.normalizeScores(testAccounts);

        System.assertEquals(70, testAccounts[0].Health_Score__c, 'Null → 70');
        System.assertEquals(100, testAccounts[1].Health_Score__c, '150 → 100');
        System.assertEquals(0, testAccounts[2].Health_Score__c, '-10 → 0');
        System.assertEquals(75, testAccounts[3].Health_Score__c, '75 unchanged');
    }

    @isTest
    static void bulkUpdateScoresUpdatesRecords() {
        List<Account> accts = [SELECT Id FROM Account LIMIT 3];
        Map<Id, Integer> updates = new Map<Id, Integer>();
        for (Account a : accts) {
            updates.put(a.Id, 99);
        }

        AccountHealthService.bulkUpdateScores(updates);

        List<Account> updated = [SELECT Health_Score__c FROM Account WHERE Id IN :accts];
        for (Account a : updated) {
            System.assertEquals(99, a.Health_Score__c);
        }
    }

    @isTest
    static void calculateAverageScoreHandlesEmptyList() {
        Integer avg = AccountHealthService.calculateAverageScore(new List<Account>());
        System.assertEquals(0, avg);
    }

    @isTest
    static void calculateAverageScoreComputesCorrectly() {
        List<Account> accts = [SELECT Health_Score__c FROM Account];
        Integer avg = AccountHealthService.calculateAverageScore(accts);
        // Scores: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90 → avg = 45
        System.assertEquals(45, avg);
    }
}
```

**Run test:**
```
sf apex run test -c
```

**Expected result:** All 8 tests pass. Coverage 100%.

---

## Section 2: SOQL and SOSL (Phase 3)

### Exercise 2.1 — Aggregate Queries

```apex
// Setup: 3 accounts with different contact counts
List<Account> accounts = new List<Account>{
    new Account(Name = 'Big Account'),
    new Account(Name = 'Med Account'),
    new Account(Name = 'Small Account')
};
insert accounts;

List<Contact> contacts = new List<Contact>();
// 5 contacts for Big Account
for (Integer i = 0; i < 5; i++) {
    contacts.add(new Contact(FirstName = 'C' + i, LastName = 'Big', AccountId = accounts[0].Id));
}
// 3 contacts for Med Account
for (Integer i = 0; i < 3; i++) {
    contacts.add(new Contact(FirstName = 'C' + i, LastName = 'Med', AccountId = accounts[1].Id));
}
// 1 contact for Small Account
contacts.add(new Contact(FirstName = 'C0', LastName = 'Small', AccountId = accounts[2].Id));
insert contacts;

// Query 1: COUNT with alias
List<AggregateResult> results = [
    SELECT AccountId, COUNT(Id) contactCount
    FROM Contact
    WHERE AccountId != null
    GROUP BY AccountId
    ORDER BY COUNT(Id) DESC
];

for (AggregateResult row : results) {
    Integer count = (Integer) row.get('contactCount');
    Id accId = (Id) row.get('AccountId');
    System.debug('Account ' + accId + ': ' + count + ' contacts');
}

// Query 2: HAVING filter
List<AggregateResult> bigAccounts = [
    SELECT AccountId, COUNT(Id) contactCount
    FROM Contact
    WHERE AccountId != null
    GROUP BY AccountId
    HAVING COUNT(Id) > 2
];
System.assertEquals(2, bigAccounts.size(), 'Big (5) and Med (3) accounts pass HAVING > 2');

// Query 3: AVG
List<AggregateResult> avgScores = [
    SELECT AVG(Health_Score__c) averageScore
    FROM Account
];
Decimal avgScore = (Decimal) avgScores[0].get('averageScore');
System.debug('Average Health Score: ' + avgScore);
```

**Expected output:**
```
Account <Big Id>: 5 contacts
Account <Med Id>: 3 contacts
Account <Small Id>: 1 contacts
Average Health Score: <calculated>
```

---

### Exercise 2.2 — Dynamic SOQL with Injection Protection

```apex
public with sharing class SafeSearchService {

    // Method 1: Concatenation with escapeSingleQuotes
    public static List<Account> searchAccounts(String searchTerm) {
        String safeTerm = String.escapeSingleQuotes(searchTerm);
        String query = 'SELECT Id, Name FROM Account WHERE Name LIKE \'%' + safeTerm + '%\' LIMIT 10';
        return Database.query(query);
    }

    // Method 2: Bind variables (preferred for values)
    public static List<Account> searchAccountsWithBind(String searchTerm) {
        String term = '%' + searchTerm + '%';
        return [SELECT Id, Name FROM Account WHERE Name LIKE :term LIMIT 10];
    }
}
```

**Test:**
```apex
@isTest
private class SafeSearchServiceTest {

    @TestSetup
    static void makeData() {
        insert new List<Account>{
            new Account(Name = 'TechCorp Industries'),
            new Account(Name = 'Acme Software'),
            new Account(Name = 'Globex Corporation')
        };
    }

    @isTest
    static void normalSearchReturnsResults() {
        List<Account> results = SafeSearchService.searchAccounts('Tech');
        System.assertEquals(1, results.size());
        System.assertEquals('TechCorp Industries', results[0].Name);
    }

    @isTest
    static void injectionAttackReturnsEmpty() {
        List<Account> results = SafeSearchService.searchAccounts("' OR 1=1 --");
        System.assertEquals(0, results.size(), 'Injection should return 0 results');
    }

    @isTest
    static void bindSearchWorks() {
        List<Account> results = SafeSearchService.searchAccountsWithBind('Acme');
        System.assertEquals(1, results.size());
        System.assertEquals('Acme Software', results[0].Name);
    }
}
```

**Expected:** Injection input returns 0 results, not all records.

---

### Exercise 2.3 — SOSL Multi-Object Search

```apex
// Setup
insert new Account(Name = 'Northwind Traders');
insert new Contact(FirstName = 'North', LastName = 'Windlass');

// SOSL search
List<List<SObject>> results = [
    FIND 'North'
    IN ALL FIELDS
    RETURNING Account(Id, Name), Contact(Id, FirstName, LastName)
];

System.debug('Account matches: ' + results[0].size());  // 1
System.debug('Contact matches: ' + results[1].size());  // 1

for (Account a : (List<Account>) results[0]) {
    System.debug('Account: ' + a.Name);
}
for (Contact c : (List<Contact>) results[1]) {
    System.debug('Contact: ' + c.FirstName + ' ' + c.LastName);
}
```

**Test with fixed results:**
```apex
@isTest
static void soslWithFixedResults() {
    Account acct = new Account(Name = 'Fixed Test');
    insert acct;

    Id[] fixedIds = new Id[]{ acct.Id };
    Test.setFixedSearchResults(new List<List<SObject>>{
        new List<SObject>{ acct },
        new List<SObject>()
    });

    List<List<SObject>> results = [
        FIND 'Fixed'
        IN ALL FIELDS
        RETURNING Account(Id, Name), Contact(Id, FirstName, LastName)
    ];

    System.assertEquals(1, results[0].size(), 'Account found via fixed results');
    System.assertEquals(0, results[1].size(), 'No contacts in fixed results');
}
```

---

### Mini Project 2: Universal Search Service

**SearchService.cls:**
```apex
public with sharing class SearchService {

    public static List<SObject> searchAcrossObjects(String term) {
        if (String.isBlank(term)) return new List<SObject>();

        String safeTerm = String.escapeSingleQuotes(term);
        List<List<SObject>> results = [
            FIND :safeTerm
            IN ALL FIELDS
            RETURNING Account(Id, Name), Contact(Id, FirstName, LastName), Lead(Id, FirstName, LastName, Company)
        ];

        List<SObject> combined = new List<SObject>();
        combined.addAll(results[0]);  // Accounts
        combined.addAll(results[1]);  // Contacts
        combined.addAll(results[2]);  // Leads
        return combined;
    }

    public static List<Account> searchAccountsWithChildren(String nameFilter, Integer minContacts) {
        String filter = '%' + String.escapeSingleQuotes(nameFilter) + '%';
        return [
            SELECT Id, Name,
                (SELECT Id, FirstName FROM Contacts)
            FROM Account
            WHERE Name LIKE :filter
            HAVING (SELECT COUNT() FROM Contacts) >= :minContacts
        ];
    }

    public static List<AggregateResult> countRecordsByObject() {
        List<AggregateResult> results = new List<AggregateResult>();

        AggregateResult acctCount = [SELECT COUNT() cnt FROM Account];
        results.add(acctCount);

        AggregateResult contactCount = [SELECT COUNT() cnt FROM Contact];
        results.add(contactCount);

        return results;
    }
}
```

**SearchServiceTest.cls:**
```apex
@isTest
private class SearchServiceTest {

    @TestSetup
    static void makeData() {
        Account a1 = new Account(Name = 'Search Alpha');
        Account a2 = new Account(Name = 'Search Beta');
        insert new List<Account>{ a1, a2 };

        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 3; i++) {
            contacts.add(new Contact(FirstName = 'Alpha', LastName = 'Contact ' + i, AccountId = a1.Id));
        }
        insert contacts;
    }

    @isTest
    static void searchAcrossObjectsReturnsCombined() {
        Id[] fixedIds = new Id[]{};
        Test.setFixedSearchResults(new List<List<SObject>>{
            new List<SObject>{ [SELECT Id FROM Account LIMIT 1] },
            new List<SObject>{ [SELECT Id FROM Contact LIMIT 1] },
            new List<SObject>{}
        });

        List<SObject> results = SearchService.searchAcrossObjects('Alpha');
        System.assert(results.size() >= 2, 'Should find Account and Contact');
    }

    @isTest
    static void searchAcrossObjectsBlankReturnsEmpty() {
        List<SObject> results = SearchService.searchAcrossObjects('');
        System.assertEquals(0, results.size());
    }

    @isTest
    static void countRecordsByObjectReturnsCounts() {
        List<AggregateResult> results = SearchService.countRecordsByObject();
        System.assertEquals(2, results.size());
        Integer acctCount = (Integer) results[0].get('cnt');
        System.assertEquals(2, acctCount);
    }
}
```

---

## Section 3: Triggers and Order of Execution (Phase 4)

### Exercise 3.1 — Before-Trigger Defaulting

**AccountDefaultTrigger.trigger:**
```apex
trigger AccountDefaultTrigger on Account (before insert) {
    for (Account acc : Trigger.new) {
        if (acc.Health_Score__c == null) {
            acc.Health_Score__c = 70;
        }
        if (acc.Description == null) {
            acc.Description = 'Auto-created on ' + Date.today();
        }
    }
}
```

**Test:**
```apex
@isTest
static void beforeTriggerSetsDefaults() {
    Account acc = new Account(Name = 'Default Test');
    insert acc;

    Account result = [SELECT Health_Score__c, Description FROM Account WHERE Id = :acc.Id];
    System.assertEquals(70, result.Health_Score__c);
    System.assert(result.Description.contains('Auto-created on'));
}

@isTest
static void beforeTriggerHandlesBulk() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 200; i++) {
        accounts.add(new Account(Name = 'Bulk Default ' + i));
    }
    insert accounts;

    List<Account> results = [SELECT Health_Score__c FROM Account WHERE Name LIKE 'Bulk Default%'];
    System.assertEquals(200, results.size());
    for (Account a : results) {
        System.assertEquals(70, a.Health_Score__c);
    }
}
```

**Expected:** All 200 records have `Health_Score__c = 70` without a second DML.

---

### Exercise 3.2 — Change Detection in After-Update

**CodeReviewChangeTrigger.trigger:**
```apex
trigger CodeReviewChangeTrigger on Code_Review__c (after update) {
    List<Integration_Log__c> logs = new List<Integration_Log__c>();

    for (Code_Review__c review : Trigger.new) {
        Code_Review__c oldReview = Trigger.oldMap.get(review.Id);

        if (oldReview.Review_Status__c != review.Review_Status__c) {
            logs.add(new Integration_Log__c(
                Direction__c = 'Internal',
                Integration_Type__c = 'Change Detection',
                Status__c = 'Success',
                Payload__c = 'Status changed from ' + oldReview.Review_Status__c + ' to ' + review.Review_Status__c,
                Correlation_Id__c = review.Id
            ));
        }
    }

    if (!logs.isEmpty()) {
        insert logs;
    }
}
```

**Test:**
```apex
@isTest
static void changeDetectionCreatesLog() {
    Code_Review__c review = new Code_Review__c(
        Review_Status__c = 'Pending',
        Comments__c = 'Initial review'
    );
    insert review;

    // Update only Comments — no status change
    review.Comments__c = 'Updated comments';
    update review;

    List<Integration_Log__c> logs = [
        SELECT Id FROM Integration_Log__c
        WHERE Correlation_Id__c = :review.Id
    ];
    System.assertEquals(0, logs.size(), 'No log for unrelated field change');

    // Now change status
    review.Review_Status__c = 'Approved';
    update review;

    logs = [
        SELECT Id FROM Integration_Log__c
        WHERE Correlation_Id__c = :review.Id
    ];
    System.assertEquals(1, logs.size(), 'Log created for status change');
}
```

---

### Exercise 3.3 — Recursion Guard

**RecursionGuard.cls:**
```apex
public class RecursionGuard {
    private static Set<Id> processedIds = new Set<Id>();

    public static Boolean shouldProcess(Id recordId) {
        return !processedIds.contains(recordId);
    }

    public static void markProcessed(Id recordId) {
        processedIds.add(recordId);
    }

    public static void reset() {
        processedIds.clear();
    }
}
```

**AccountRecursionTrigger.trigger:**
```apex
trigger AccountRecursionTrigger on Account (after update) {
    List<Account> toUpdate = new List<Account>();

    for (Account acc : Trigger.new) {
        if (RecursionGuard.shouldProcess(acc.Id)) {
            Account oldAcc = Trigger.oldMap.get(acc.Id);

            if (acc.Health_Score__c != oldAcc.Health_Score__c) {
                RecursionGuard.markProcessed(acc.Id);
                acc.Description = 'Score changed to ' + acc.Health_Score__c;
                toUpdate.add(acc);
            }
        }
    }

    if (!toUpdate.isEmpty()) {
        // Use a flag to prevent re-entry on the DML
        TriggerHandlerService.suppress('AccountRecursionTrigger');
        update toUpdate;
        TriggerHandlerService.restore('AccountRecursionTrigger');
    }
}
```

**Test:**
```apex
@isTest
static void recursionGuardPreventsInfiniteLoop() {
    RecursionGuard.reset();
    Account acc = new Account(Name = 'Recursion Test', Health_Score__c = 50);
    insert acc;

    acc.Health_Score__c = 80;
    update acc;

    Account result = [SELECT Description FROM Account WHERE Id = :acc.Id];
    System.assert(result.Description.contains('Score changed to 80'),
        'Description should reflect the score change');
    System.assert(!result.Description.contains('Score changed to'), 
        'Should not have triggered recursion');
}
```

---

### Mini Project 3: Lead Auto-Assignment Engine

**Lead_Routing_Rule__mdt** custom metadata fields: `Industry__c` (Text), `Owner__c` (Text storing User Id), `Priority__c` (Number).

**LeadAssignmentHandler.cls:**
```apex
public with sharing class LeadAssignmentHandler {

    public static void assignLeads(List<Lead> leads) {
        Set<String> industries = new Set<String>();
        for (Lead l : leads) {
            if (String.isNotBlank(l.Industry)) {
                industries.add(l.Industry);
            }
        }

        if (industries.isEmpty()) return;

        Map<String, Lead_Routing_Rule__mdt> rulesByIndustry = new Map<String, Lead_Routing_Rule__mdt>();
        for (Lead_Routing_Rule__mdt rule : [
            SELECT Industry__c, Owner__c, Priority__c
            FROM Lead_Routing_Rule__mdt
            WHERE Industry__c IN :industries
            ORDER BY Priority__c ASC
        ]) {
            // First rule per industry wins (lowest priority number)
            if (!rulesByIndustry.containsKey(rule.Industry__c)) {
                rulesByIndustry.put(rule.Industry__c, rule);
            }
        }

        for (Lead l : leads) {
            if (String.isNotBlank(l.Industry) && rulesByIndustry.containsKey(l.Industry)) {
                Lead_Routing_Rule__mdt rule = rulesByIndustry.get(l.Industry);
                l.OwnerId = Id.valueOf(rule.Owner__c);
                l.Assignment_Source__c = 'Rule: ' + rule.Industry__c;
            }
        }
    }
}
```

**LeadAutoAssignmentTrigger.trigger:**
```apex
trigger LeadAutoAssignmentTrigger on Lead (before insert) {
    LeadAssignmentHandler.assignLeads(Trigger.new);
}
```

**LeadAssignmentHandlerTest.cls:**
```apex
@isTest
private class LeadAssignmentHandlerTest {

    @TestSetup
    static void makeData() {
        User standardUser = [SELECT Id FROM User WHERE Profile.Name = 'Standard User' LIMIT 1];

        // Note: In real orgs, insert custom metadata via code or test setup
        // For testing, we test the handler logic directly
    }

    @isTest
    static void leadsWithMatchingRulesAreAssigned() {
        // Test handler logic directly
        List<Lead> leads = new List<Lead>{
            new Lead(FirstName = 'Test', LastName = 'Lead 1', Industry = 'Technology', Company = 'TestCo'),
            new Lead(FirstName = 'Test', LastName = 'Lead 2', Industry = 'Healthcare', Company = 'TestCo'),
            new Lead(FirstName = 'Test', LastName = 'Lead 3', Industry = 'Unknown Industry', Company = 'TestCo')
        };

        LeadAssignmentHandler.assignLeads(leads);

        // Leads with matching rules should have Assignment_Source__c set
        for (Lead l : leads) {
            if (l.Industry == 'Technology' || l.Industry == 'Healthcare') {
                System.assertNotEquals(null, l.Assignment_Source__c,
                    l.Industry + ' should have a rule');
            } else {
                System.assertEquals(null, l.Assignment_Source__c,
                    'Unknown Industry should have no rule');
            }
        }
    }

    @isTest
    static void bulkInsertHandles200Leads() {
        List<Lead> leads = new List<Lead>();
        for (Integer i = 0; i < 200; i++) {
            leads.add(new Lead(
                FirstName = 'Bulk',
                LastName = 'Lead ' + i,
                Industry = 'Technology',
                Company = 'BulkCo'
            ));
        }

        LeadAssignmentHandler.assignLeads(leads);
        System.assertEquals(200, leads.size());

        Integer assigned = 0;
        for (Lead l : leads) {
            if (l.Assignment_Source__c != null) assigned++;
        }
        System.assertEquals(200, assigned, 'All Technology leads should be assigned');
    }
}
```

---

## Section 4: Async Apex and Platform Events (Phase 5)

### Exercise 4.1 — Queueable Lifecycle

**SimpleQueueable.cls:**
```apex
public class SimpleQueueable implements Queueable {
    private Id monitorId;
    private Boolean shouldFail;

    public SimpleQueueable(Id monitorId) {
        this(monitorId, false);
    }

    public SimpleQueueable(Id monitorId, Boolean shouldFail) {
        this.monitorId = monitorId;
        this.shouldFail = shouldFail;
    }

    public void execute(QueueableContext context) {
        Async_Job_Monitor__c monitor = [
            SELECT Id, Job_Status__c FROM Async_Job_Monitor__c WHERE Id = :monitorId
        ];
        monitor.Job_Status__c = 'Running';
        update monitor;

        if (shouldFail) {
            monitor.Job_Status__c = 'Failed';
            monitor.Error_Message__c = 'Simulated failure';
            update monitor;
            throw new TestException('Simulated queueable failure');
        }

        // Simulate work
        monitor.Job_Status__c = 'Completed';
        monitor.Finished_At__c = System.now();
        update monitor;
    }

    private class TestException extends Exception {}
}
```

**Test:**
```apex
@isTest
static void queueableCompletesSuccessfully() {
    Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
        Job_Type__c = 'Queueable',
        Job_Status__c = 'Queued',
        Related_Object__c = 'Account'
    );
    insert monitor;

    Test.startTest();
    System.enqueueJob(new SimpleQueueable(monitor.Id));
    Test.stopTest();

    Async_Job_Monitor__c result = [
        SELECT Job_Status__c FROM Async_Job_Monitor__c WHERE Id = :monitor.Id
    ];
    System.assertEquals('Completed', result.Job_Status__c);
}

@isTest
static void queueableHandlesFailure() {
    Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
        Job_Type__c = 'Queueable',
        Job_Status__c = 'Queued',
        Related_Object__c = 'Account'
    );
    insert monitor;

    Test.startTest();
    System.enqueueJob(new SimpleQueueable(monitor.Id, true));
    Test.stopTest();

    Async_Job_Monitor__c result = [
        SELECT Job_Status__c, Error_Message__c FROM Async_Job_Monitor__c WHERE Id = :monitor.Id
    ];
    System.assertEquals('Failed', result.Job_Status__c);
    System.assertNotEquals(null, result.Error_Message__c);
}
```

---

### Exercise 4.2 — Batch Apex

**ScoreBatch.cls:**
```apex
public class ScoreBatch implements Database.Batchable<sObject> {

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator('SELECT Id, Health_Score__c FROM Account');
    }

    public void execute(Database.BatchableContext bc, List<sObject> scope) {
        List<Account> accounts = (List<Account>) scope;
        for (Account acc : accounts) {
            if (acc.Health_Score__c == null) {
                acc.Health_Score__c = 70;
            } else if (acc.Health_Score__c < 0) {
                acc.Health_Score__c = 0;
            } else if (acc.Health_Score__c > 100) {
                acc.Health_Score__c = 100;
            }
        }
        update accounts;
    }

    public void finish(Database.BatchableContext bc) {
        System.debug('ScoreBatch completed.');
    }
}
```

**Test:**
```apex
@isTest
static void batchProcessesAllRecords() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 500; i++) {
        accounts.add(new Account(
            Name = 'Batch Test ' + i,
            Health_Score__c = Math.random() * 200 - 50  // range: -50 to 150
        ));
    }
    insert accounts;

    Test.startTest();
    Database.executeBatch(new ScoreBatch(), 200);
    Test.stopTest();

    List<Account> results = [SELECT Health_Score__c FROM Account WHERE Name LIKE 'Batch Test%'];
    System.assertEquals(500, results.size());
    for (Account a : results) {
        System.assert(a.Health_Score__c >= 0, 'Score should be >= 0');
        System.assert(a.Health_Score__c <= 100, 'Score should be <= 100');
    }
}
```

**Expected:** Scope 200 → 3 batches. Scope 2000 → 1 batch.

---

### Exercise 4.3 — Platform Event Round Trip

**Test_Notification__e** platform event with `Message__c` and `Source__c` fields.

**TestNotificationTrigger.trigger:**
```apex
trigger TestNotificationTrigger on Test_Notification__e (after insert) {
    if (!TriggerHandlerService.shouldRun('TestNotificationTrigger')) return;

    List<Integration_Log__c> logs = new List<Integration_Log__c>();
    for (Test_Notification__e evt : Trigger.new) {
        logs.add(new Integration_Log__c(
            Direction__c = 'Internal',
            Integration_Type__c = 'Notification',
            Status__c = 'Success',
            Payload__c = evt.Message__c,
            Correlation_Id__c = evt.Source__c
        ));
    }

    TriggerHandlerService.suppress('IntegrationLogTrigger');
    insert logs;
    TriggerHandlerService.restore('IntegrationLogTrigger');
}
```

**Test:**
```apex
@isTest
static void platformEventMaterializesLog() {
    List<Test_Notification__e> events = new List<Test_Notification__e>();
    for (Integer i = 0; i < 5; i++) {
        events.add(new Test_Notification__e(
            Message__c = 'Test message ' + i,
            Source__c = 'TEST-' + i
        ));
    }

    Test.startTest();
    EventBus.publish(events);
    Test.stopTest();

    List<Integration_Log__c> logs = [
        SELECT Id, Payload__c FROM Integration_Log__c
        WHERE Direction__c = 'Internal' AND Integration_Type__c = 'Notification'
    ];
    System.assertEquals(5, logs.size(), '5 events should produce 5 log records');
}
```

---

### Mini Project 4: Data Sync Pipeline

**Sync_Event__e** platform event with `Object_Name__c` and `Sync_Date__c` fields.

**DataSyncService.cls:**
```apex
public with sharing class DataSyncService {

    public static Id startSync(String objectName) {
        // Create a monitor record
        Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
            Job_Type__c = 'DataSync',
            Job_Status__c = 'Queued',
            Related_Object__c = objectName
        );
        insert monitor;

        // Enqueue the sync job
        System.enqueueJob(new SyncQueueable(monitor.Id, objectName));
        return monitor.Id;
    }

    public class SyncQueueable implements Queueable {
        private Id monitorId;
        private String objectName;

        public SyncQueueable(Id monitorId, String objectName) {
            this.monitorId = monitorId;
            this.objectName = objectName;
        }

        public void execute(QueueableContext ctx) {
            // Update monitor
            Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
                Id = monitorId,
                Job_Status__c = 'Running',
                Started_At__c = System.now()
            );
            update monitor;

            // Publish sync event
            Integration_Event__e evt = new Integration_Event__e(
                Source_Object__c = objectName,
                Direction__c = 'Internal',
                Integration_Type__c = 'DataSync',
                Status__c = 'Success',
                Correlation_Id__c = monitorId,
                Payload__c = 'Sync started for ' + objectName
            );
            EventBus.publish(new List<Integration_Event__e>{ evt });

            // Complete
            monitor.Job_Status__c = 'Completed';
            monitor.Finished_At__c = System.now();
            update monitor;
        }
    }
}
```

**Test:**
```apex
@isTest
static void startSyncUpdatesConfigAndPublishesEvent() {
    Test.startTest();
    Id monitorId = DataSyncService.startSync('Account');
    Test.stopTest();

    Async_Job_Monitor__c monitor = [
        SELECT Job_Status__c, Related_Object__c
        FROM Async_Job_Monitor__c
        WHERE Id = :monitorId
    ];
    System.assertEquals('Completed', monitor.Job_Status__c);
    System.assertEquals('Account', monitor.Related_Object__c);
}
```

---

## Section 5: Automation — Flows and Apex (Phase 6)

### Exercise 5.1 — @InvocableMethod

**ScoreCalculatorService.cls:**
```apex
public with sharing class ScoreCalculatorService {

    @InvocableMethod(
        label='Calculate Score'
        description='Clamps a score to 0-100 and returns the result.'
    )
    public static List<Result> calculate(List<Request> requests) {
        List<Result> results = new List<Result>();
        for (Request req : requests) {
            Integer raw = req.rawScore;
            Integer clamped;
            if (raw == null) {
                clamped = 70;
            } else if (raw < 0) {
                clamped = 0;
            } else if (raw > 100) {
                clamped = 100;
            } else {
                clamped = raw;
            }
            results.add(new Result(clamped));
        }
        return results;
    }

    public class Request {
        @InvocableVariable(label='Raw Score' required=true)
        public Integer rawScore;
    }

    public class Result {
        @InvocableVariable(label='Clamped Score')
        public Integer clampedScore;

        public Result(Integer value) {
            this.clampedScore = value;
        }
    }
}
```

**Test:**
```apex
@isTest
static void calculateClampsValues() {
    List<ScoreCalculatorService.Request> requests = new List<ScoreCalculatorService.Request>();

    ScoreCalculatorService.Request r1 = new ScoreCalculatorService.Request();
    r1.rawScore = 150;
    requests.add(r1);

    ScoreCalculatorService.Request r2 = new ScoreCalculatorService.Request();
    r2.rawScore = -10;
    requests.add(r2);

    ScoreCalculatorService.Request r3 = new ScoreCalculatorService.Request();
    r3.rawScore = null;
    requests.add(r3);

    ScoreCalculatorService.Request r4 = new ScoreCalculatorService.Request();
    r4.rawScore = 75;
    requests.add(r4);

    List<ScoreCalculatorService.Result> results = ScoreCalculatorService.calculate(requests);

    System.assertEquals(100, results[0].clampedScore, '150 → 100');
    System.assertEquals(0, results[1].clampedScore, '-10 → 0');
    System.assertEquals(70, results[2].clampedScore, 'null → 70');
    System.assertEquals(75, results[3].clampedScore, '75 unchanged');
}
```

---

### Exercise 5.2 — Flow vs Trigger Decision Matrix

| Scenario | Choice | Justification |
|----------|--------|---------------|
| (a) Set default Health Score | **Before-trigger** (or before-save Flow) | Zero DML cost; both work equally well. |
| (b) Email on score drop below 30 | **After-trigger + Apex** | Requires conditional email with complex logic; Flow can do it but Apex gives more control. |
| (c) Nightly batch recalculation | **Apex Batch** | Flow cannot handle millions of records; batch is the correct scale tool. |
| (d) Screen collecting user input | **Screen Flow** | Flow is purpose-built for wizards; Apex cannot render a screen. |
| (e) Call external API on close | **After-trigger + Apex** | Callouts require Apex HTTP; Flow cannot make callouts in record-triggered context. |
| (f) Create 3 child records | **Before-save Flow or Trigger** | Both work; Flow is simpler for admin-maintainable logic. |

---

## Section 6: UI Foundations (Phases 7–8)

### Exercise 6.1 — Visualforce Custom Controller

**AccountSearchController.cls:**
```apex
public with sharing class AccountSearchController {
    public String searchTerm { get; set; }
    public List<Account> accounts { get; set; }

    public AccountSearchController() {
        accounts = new List<Account>();
    }

    public PageReference search() {
        if (String.isBlank(searchTerm)) {
            accounts = new List<Account>();
            return null;
        }
        accounts = [
            SELECT Id, Name, Industry, Health_Score__c
            FROM Account
            WHERE Name LIKE :('%' + searchTerm + '%')
            ORDER BY Name
            LIMIT 50
        ];
        return null;
    }
}
```

**AccountSearchPage.page:**
```xml
<apex:page controller="AccountSearchController">
    <apex:form>
        <apex:pageBlock title="Account Search">
            <apex:pageBlockSection>
                <apex:inputText value="{!searchTerm}" label="Search Term" />
                <apex:commandButton value="Search" action="{!search}" reRender="results" />
            </apex:pageBlockSection>
        </apex:pageBlock>

        <apex:outputPanel id="results">
            <apex:pageBlock title="Results" rendered="{!accounts.size > 0}">
                <apex:pageBlockTable value="{!accounts}" var="acc">
                    <apex:column value="{!acc.Name}" />
                    <apex:column value="{!acc.Industry}" />
                    <apex:column value="{!acc.Health_Score__c}" />
                </apex:pageBlockTable>
            </apex:pageBlock>
            <apex:outputPanel rendered="{!accounts.size == 0}">
                <p>No accounts found.</p>
            </apex:outputPanel>
        </apex:outputPanel>

        <apex:pageMessages />
    </apex:form>
</apex:page>
```

---

### Exercise 6.2 — Aura Component

**accountAuraList.cmp:**
```xml
<aura:component controller="AccountAuraController">
    <aura:handler name="init" value="{!this}" action="{!c.doInit}" />
    <aura:registerEvent type="c:AccountSelected" />

    <aura:attribute name="accounts" type="Account[]" />
    <aura:attribute name="error" type="String" />

    <lightning:card title="Top Accounts by Health Score">
        <aura:if isTrue="{!v.error}">
            <p class="slds-text-color_error">{!v.error}</p>
        </aura:if>
        <aura:if isTrue="{!v.accounts.length > 0}">
            <ul>
                <aura:iteration items="{!v.accounts}" var="acc">
                    <li onclick="{!c.selectAccount}" data-id="{!acc.Id}">
                        {!acc.Name} — Score: {!acc.Health_Score__c}
                    </li>
                </aura:iteration>
            </ul>
        </aura:if>
    </lightning:card>
</aura:component>
```

**accountAuraListController.js:**
```js
({
    doInit: function (component, event, helper) {
        var action = component.get('c.getTopAccounts');
        action.setCallback(this, function (response) {
            if (response.getState() === 'SUCCESS') {
                component.set('v.accounts', response.getReturnValue());
            } else {
                component.set('v.error', response.getError()[0].message);
            }
        });
        $A.enqueueAction(action);
    },

    selectAccount: function (component, event, helper) {
        var accountId = event.currentTarget.getAttribute('data-id');
        var appEvent = $A.get('e.c:AccountSelected');
        appEvent.setParams({ accountId: accountId });
        appEvent.fire();
    }
})
```

**AccountAuraController.cls:**
```apex
public with sharing class AccountAuraController {
    @AuraEnabled(cacheable=true)
    public static List<Account> getTopAccounts() {
        return [
            SELECT Id, Name, Health_Score__c
            FROM Account
            ORDER BY Health_Score__c DESC
            LIMIT 10
        ];
    }
}
```

---

### Exercise 6.3 — LWC with Wire and Imperative

**accountListLwc/accountListLwc.js:**
```js
import { LightningElement, track } from 'lwc';
import getAccounts from '@salesforce/apex/LwcDataService.getAccountsWithContacts';
import createTestAccount from '@salesforce/apex/LwcDataService.createTestAccount';
import { refreshApex } from '@salesforce/apex';

export default class AccountListLwc extends LightningElement {
    @track accounts;
    @track error;
    wiredResult;

    columns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Health Score', fieldName: 'Health_Score__c', type: 'number' },
        { label: 'Industry', fieldName: 'Industry', type: 'text' }
    ];

    @wire(getAccounts)
    wiredAccounts(result) {
        this.wiredResult = result;
        if (result.data) {
            this.accounts = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.accounts = undefined;
        }
    }

    handleRefresh() {
        refreshApex(this.wiredResult);
    }

    handleCreateAccount() {
        createTestAccount()
            .then(() => {
                return refreshApex(this.wiredResult);
            })
            .catch(error => {
                this.error = error;
            });
    }
}
```

**accountListLwc/accountListLwc.html:**
```html
<template>
    <lightning-card title="Account List" icon-name="standard:account">
        <template if:true={accounts}>
            <lightning-datatable
                data={accounts}
                columns={columns}
                key-field="Id">
            </lightning-datatable>
        </template>
        <template if:true={error}>
            <p class="slds-text-color_error">{error}</p>
        </template>
        <lightning-button label="Refresh" onclick={handleRefresh} slot="actions">
        </lightning-button>
        <lightning-button label="Create Test Account" onclick={handleCreateAccount} slot="actions">
        </lightning-button>
    </lightning-card>
</template>
```

**accountListLwc/accountListLwc.js-meta.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>68.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
    </targets>
</LightningComponentBundle>
```

---

### Exercise 6.4 — LWC Parent-Child Communication

**accountManager/accountManager.js:**
```js
import { LightningElement, track } from 'lwc';
import getAccounts from '@salesforce/apex/LwcDataService.getAccountsWithContacts';

export default class AccountManager extends LightningElement {
    @track accounts = [];

    @wire(getAccounts)
    wiredAccounts({ data, error }) {
        if (data) {
            this.accounts = data.map(acc => ({ ...acc }));
        }
    }

    handleAccountDelete(event) {
        const deletedId = event.detail;
        this.accounts = this.accounts.filter(acc => acc.Id !== deletedId);
    }
}
```

**accountManager/accountManager.html:**
```html
<template>
    <lightning-card title="Account Manager">
        <template for:each={accounts} for:item="acc">
            <c-account-card
                key={acc.Id}
                account={acc}
                onaccountdelete={handleAccountDelete}>
            </c-account-card>
        </template>
    </lightning-card>
</template>
```

**accountCard/accountCard.js:**
```js
import { LightningElement, api } from 'lwc';

export default class AccountCard extends LightningElement {
    @api account;

    handleDelete() {
        const event = new CustomEvent('accountdelete', {
            detail: this.account.Id
        });
        this.dispatchEvent(event);
    }
}
```

**accountCard/accountCard.html:**
```html
<template>
    <lightning-card title={account.Name}>
        <p>Health Score: {account.Health_Score__c}</p>
        <lightning-button label="Delete" onclick={handleDelete} variant="destructive">
        </lightning-button>
    </lightning-card>
</template>
```

---

## Section 7: Testing and Debugging (Phase 9)

### Exercise 7.1 — @TestSetup and Data Isolation

```apex
@isTest
private class DataIsolationTest {

    @TestSetup
    static void makeData() {
        insert new List<Account>{
            new Account(Name = 'Setup Account 1'),
            new Account(Name = 'Setup Account 2'),
            new Account(Name = 'Setup Account 3')
        };
    }

    @isTest
    static void onlySetupDataVisible() {
        List<Account> accounts = [SELECT Id FROM Account];
        System.assertEquals(3, accounts.size(), 'Only 3 setup accounts should be visible');
    }

    @isTest
    static void secondTestSeesSameSetupData() {
        List<Account> accounts = [SELECT Id FROM Account];
        System.assertEquals(3, accounts.size(), 'Setup data persists across test methods');
    }

    @isTest
    static void addingRecordsWithinMethod() {
        insert new List<Account>{
            new Account(Name = 'Method Account 1'),
            new Account(Name = 'Method Account 2')
        };

        List<Account> accounts = [SELECT Id FROM Account];
        System.assertEquals(5, accounts.size(), '3 setup + 2 method-level = 5');
    }
}
```

---

### Exercise 7.2 — Test.startTest/stopTest

```apex
@isTest
static void queueableForcedByStartStop() {
    Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
        Job_Type__c = 'Queueable',
        Job_Status__c = 'Queued'
    );
    insert monitor;

    Integer queriesBefore = Limits.getQueries();

    Test.startTest();
    System.enqueueJob(new SimpleQueueable(monitor.Id));
    Test.stopTest();

    Integer queriesAfter = Limits.getQueries();

    // The job has completed because stopTest forced it
    Async_Job_Monitor__c result = [
        SELECT Job_Status__c FROM Async_Job_Monitor__c WHERE Id = :monitor.Id
    ];
    System.assertEquals('Completed', result.Job_Status__c,
        'Job should be completed after Test.stopTest()');

    // Governor counters are fresh inside start/stop window
    System.debug('Queries before startTest: ' + queriesBefore);
    System.debug('Queries after stopTest: ' + queriesAfter);
}
```

---

### Exercise 7.3 — HTTP Callout Mock

**MockApiService.cls:**
```apex
@isTest
global class MockApiService implements HttpCalloutMock {
    private Integer attempts = 0;

    global HttpResponse respond(HttpRequest req) {
        attempts++;
        HttpResponse res = new HttpResponse();
        res.setStatusCode(attempts == 1 ? 502 : 200);
        res.setBody('{"attempt":' + attempts + '}');
        res.setHeader('Content-Type', 'application/json');
        return res;
    }
}

@isTest
global class MockApiFailAll implements HttpCalloutMock {
    global HttpResponse respond(HttpRequest req) {
        HttpResponse res = new HttpResponse();
        res.setStatusCode(500);
        res.setBody('{"error":"server down"}');
        return res;
    }
}
```

**Test:**
```apex
@isTest
static void retryMockSucceedsOnSecondAttempt() {
    Test.setMock(HttpCalloutMock.class, new MockApiService());

    IntegrationService.CalloutResult result =
        IntegrationService.callOutbound('GET', '/health', null);

    System.assert(result.success, 'Should succeed after retry');
}

@isTest
static void failAllMockReportsFailure() {
    Test.setMock(HttpCalloutMock.class, new MockApiFailAll());

    IntegrationService.CalloutResult result =
        IntegrationService.callOutbound('GET', '/health', null);

    System.assert(!result.success, 'Should fail after all retries exhausted');
}
```

---

## Section 8: Performance and Large Data Volumes (Phase 10)

### Exercise 8.1 — Query Plan Analysis

**Expected Query Plan results:**

| Query | Selective? | Notes |
|-------|-----------|-------|
| `WHERE Health_Score__c > 50` | Yes (if indexed) | Uses custom index |
| `WHERE Name LIKE '%Corp%'` | No | Leading wildcard forces table scan |
| `WHERE Name LIKE 'Corp%'` | Yes | Prefix match uses Name index |
| `WHERE Health_Score__c > 50 AND Industry = 'Technology'` | Compound | Uses compound index if available |

**After adding custom index on Health_Score__c:**
- Cost drops significantly for the indexed field query.

---

### Exercise 8.2 — Map Join vs Nested Loop

```apex
// Nested loop approach — O(n*m)
public static Integer nestedLoopJoin(List<Account> accounts, List<Contact> contacts) {
    Integer cpuBefore = Limits.getCpuTime();
    Map<Id, List<Contact>> result = new Map<Id, List<Contact>>();

    for (Account a : accounts) {
        result.put(a.Id, new List<Contact>());
        for (Contact c : contacts) {
            if (c.AccountId == a.Id) {
                result.get(a.Id).add(c);
            }
        }
    }

    return Limits.getCpuTime() - cpuBefore;
}

// Map join approach — O(n+m)
public static Integer mapJoin(List<Account> accounts, List<Contact> contacts) {
    Integer cpuBefore = Limits.getCpuTime();

    Map<Id, List<Contact>> byAccount = new Map<Id, List<Contact>>();
    for (Contact c : contacts) {
        if (c.AccountId == null) continue;
        if (!byAccount.containsKey(c.AccountId)) {
            byAccount.put(c.AccountId, new List<Contact>());
        }
        byAccount.get(c.AccountId).add(c);
    }

    Map<Id, List<Contact>> result = new Map<Id, List<Contact>>();
    for (Account a : accounts) {
        List<Contact> matched = byAccount.containsKey(a.Id)
            ? byAccount.get(a.Id)
            : new List<Contact>();
        result.put(a.Id, matched);
    }

    return Limits.getCpuTime() - cpuBefore;
}
```

**Test:**
```apex
@isTest
static void mapJoinIsFaster() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 10; i++) {
        accounts.add(new Account(Name = 'Map Test ' + i));
    }
    insert accounts;

    List<Contact> contacts = new List<Contact>();
    for (Integer i = 0; i < 500; i++) {
        contacts.add(new Contact(
            FirstName = 'C' + i,
            LastName = 'Test',
            AccountId = accounts[Math.mod(i, 10)].Id
        ));
    }
    insert contacts;

    List<Account> allAccounts = [SELECT Id FROM Account WHERE Name LIKE 'Map Test%'];
    List<Contact> allContacts = [SELECT Id, AccountId FROM Contact WHERE LastName = 'Test'];

    Integer nestedCpu = PerformanceService.nestedLoopJoin(allAccounts, allContacts);
    Integer mapCpu = PerformanceService.mapJoin(allAccounts, allContacts);

    System.debug('Nested loop CPU: ' + nestedCpu + ' ms');
    System.debug('Map join CPU: ' + mapCpu + ' ms');
    System.assert(mapCpu < nestedCpu, 'Map join should be faster');
}
```

---

## Section 9: Integration and Enterprise Patterns (Phase 11)

### Exercise 9.1 — Named Credential Callout

```apex
// Anonymous Apex
HttpRequest req = new HttpRequest();
req.setEndpoint('callout:Mock_API/test');
req.setMethod('GET');
req.setHeader('Content-Type', 'application/json');
req.setTimeout(10000);

Http http = new Http();
try {
    HttpResponse res = http.send(req);
    System.debug('Status: ' + res.getStatusCode());
    System.debug('Body: ' + res.getBody());
} catch (Exception e) {
    System.debug('Error: ' + e.getMessage());
}
```

**Test:**
```apex
@isTest
static void namedCredentialCalloutWorks() {
    Test.setMock(HttpCalloutMock.class, new MockApiService());
    IntegrationService.CalloutResult result =
        IntegrationService.callOutbound('GET', '/test', null);

    System.assert(result.success);

    Integration_Log__c log = [
        SELECT Endpoint__c, Status__c FROM Integration_Log__c LIMIT 1
    ];
    System.assert(log.Endpoint__c.contains('Mock_API'));
}
```

---

### Exercise 9.2 — REST Resource

**MyRestService.cls:**
```apex
@RestResource(urlMapping='/MyService/v1/items/*')
global with sharing class MyRestService {

    @HttpGet
    global static List<Integration_Log__c> getItems() {
        RestRequest req = RestContext.request;
        String uri = req.requestURI;
        // Parse trailing Id if present
        if (uri.contains('/items/')) {
            String recordId = uri.substringAfter('/items/');
            return [SELECT Id, Status__c, Payload__c FROM Integration_Log__c WHERE Id = :recordId];
        }
        return [SELECT Id, Status__c, Payload__c FROM Integration_Log__c ORDER BY CreatedDate DESC LIMIT 20];
    }

    @HttpPost
    global static Integration_Log__c createItem(Integration_Log__c incoming) {
        incoming.Direction__c = 'Inbound';
        insert incoming;
        RestContext.response.statusCode = 201;
        return incoming;
    }

    @HttpPatch
    global static Integration_Log__c updateItem() {
        RestRequest req = RestContext.request;
        String recordId = req.requestURI.substringAfter('/items/');
        Map<String, Object> fields = (Map<String, Object>) JSON.deserializeUntyped(req.requestBody.toString());

        Integration_Log__c record = new Integration_Log__c(Id = recordId);
        for (String fieldName : fields.keySet()) {
            record.put(fieldName, fields.get(fieldName));
        }
        update record;
        return record;
    }

    @HttpDelete
    global static void deleteItem() {
        String recordId = RestContext.request.requestURI.substringAfter('/items/');
        delete [SELECT Id FROM Integration_Log__c WHERE Id = :recordId];
        RestContext.response.statusCode = 204;
    }
}
```

**Test:**
```apex
@isTest
static void restGetReturnsRecords() {
    insert new Integration_Log__c(Status__c = 'Test', Direction__c = 'Inbound');

    RestRequest req = new RestRequest();
    req.requestURI = '/services/apexrest/MyService/v1/items';
    req.httpMethod = 'GET';
    RestContext.request = req;

    List<Integration_Log__c> results = MyRestService.getItems();
    System.assert(results.size() > 0);
}

@isTest
static void restPostCreatesRecord() {
    RestRequest req = new RestRequest();
    req.requestURI = '/services/apexrest/MyService/v1/items';
    req.httpMethod = 'POST';
    req.requestBody = Blob.valueOf(JSON.serialize(
        new Integration_Log__c(Status__c = 'Created', Direction__c = 'Inbound')
    ));
    RestContext.request = req;
    RestContext.response = new RestResponse();

    Integration_Log__c result = MyRestService.createItem(
        new Integration_Log__c(Status__c = 'Created', Direction__c = 'Inbound')
    );
    System.assertNotEquals(null, result.Id);
    System.assertEquals(201, RestContext.response.statusCode);
}
```

---

## Section 10: Release Management and CI/CD (Phase 12)

### Exercise 10.1 — Scratch Org Lifecycle

```bash
# Step 1: Create scratch org
sf org create scratch -f config/project-scratch-def.json -a test1 -d 1

# Step 2: Deploy source
sf project deploy start --source-dir force-app --target-org test1

# Step 3: Run tests with coverage
sf apex run test -c --target-org test1 --test-level RunLocalTests --result-format human

# Step 4: Record coverage (look for Overall org coverage percentage)

# Step 5: Destroy
sf org delete scratch --target-org test1 --no-prompt

# Step 6: Repeat with test2
sf org create scratch -f config/project-scratch-def.json -a test2 -d 1
sf project deploy start --source-dir force-app --target-org test2
sf apex run test -c --target-org test2 --test-level RunLocalTests
sf org delete scratch --target-org test2 --no-prompt
```

**Expected:** Both orgs show consistent coverage percentages.

---

### Exercise 10.2 — Destructive Deployment

**destructiveChanges.xml:**
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

**package.xml (empty manifest for deletion):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>68.0</version>
</Package>
```

**Deploy:**
```bash
sf project deploy start --manifest manifest/package.xml --post-destructive-changes destructiveChanges.xml --target-org <orgAlias>
```

**Verify:**
```bash
sf org list metadata --metadata-type ApexClass --target-org <orgAlias> | grep StaleHelper
# Should return nothing — class is deleted
```

---

## Mini Project Solutions Summary

Each mini project follows the same testing pattern:
1. `@TestSetup` creates reusable data.
2. Test methods cover happy path, edge cases, and bulk.
3. `sf apex run test -c` confirms ≥75% coverage.

For the **Capstone Project**, the quiz platform combines all the patterns above. The key implementation files would be:

| Component | File | Phase Reference |
|-----------|------|-----------------|
| Data model | Custom objects in `force-app/main/default/objects/` | Phase 1 |
| Service layer | `QuizService.cls`, `QuestionService.cls` | Phase 2 |
| Queries | `QuizQueryService.cls` | Phase 3 |
| Triggers | `QuestionTrigger`, `QuizResultTrigger` | Phase 4 |
| Async jobs | `QuizStatsBatch.cls`, `QuizSyncQueueable.cls` | Phase 5 |
| Invocable | `QuizScoringService.cls` | Phase 6 |
| LWC quiz UI | `quizPlayer/` component | Phase 8 |
| VF admin page | `QuizAdmin.page` | Phase 7 |
| Tests | `QuizServiceTest.cls`, etc. | Phase 9 |
| Performance | Map joins in `QuizStatsBatch` | Phase 10 |
| Integration | `QuizRestApi.cls`, `QuizEvent__e` | Phase 11 |
| CI/CD | `.github/workflows/ci.yml` | Phase 12 |

---

## Common Mistakes Reference

| Exercise | Common Mistake | Fix |
|----------|---------------|-----|
| 1.1 | Querying inside a for loop | Use subquery or collect IDs, then one query |
| 1.2 | Separate delete statements for each record | `delete list` in one statement |
| 1.3 | Using `accounts[0]` after building a map | Use `map.get(id)` |
| 1.4 | Running test without `System.runAs` | Low-privilege user test requires runAs |
| 1.5 | Catching generic Exception first | Catch `DmlException` before `Exception` |
| 2.1 | Reading aggregate by field name | Always use alias: `row.get('contactCount')` |
| 2.2 | Using concatenation without `escapeSingleQuotes` | Always escape or use bind variables |
| 2.3 | Accessing results[0] as the wrong type | Index matches RETURNING order |
| 3.1 | Setting defaults in after trigger | Use before trigger for free field saves |
| 3.2 | Comparing without Trigger.oldMap | Always use oldMap for change detection |
| 3.3 | Static set not reset between tests | Call `reset()` in @TestSetup |
| 4.1 | Forgetting Test.startTest/stopTest | Queueable won't complete without it |
| 4.2 | Scope > 2000 | Max batch scope is 2000 |
| 4.3 | Publishing events without suppress guard | Use TriggerHandlerService.suppress/restore |
| 5.1 | Non-static @InvocableMethod | Must be static |
| 5.1 | Returning a single Result instead of List | Always return List |
| 6.1 | Missing `reRender` on commandButton | Partial refresh requires reRender attribute |
| 6.2 | Calling @AuraEnabled without `$A.enqueueAction` | Aura requires enqueueAction for server calls |
| 6.3 | Using @wire for DML operations | Wire is read-only; use imperative for writes |
| 6.4 | Dispatching CustomEvent without detail | Always pass data via `{ detail: value }` |
| 7.1 | Asserting org data in tests | SeeAllData=false means only test data visible |
| 7.2 | Asserting before Test.stopTest() | Job hasn't completed yet; assert after stopTest |
| 7.3 | Forgetting Test.setMock before the callout | Mock must be installed before any callout |
| 8.1 | LIKE '%value%' offered as selective | Leading wildcard is always non-selective |
| 8.2 | Nested loop in production code | Use Map join for O(n+m) |
| 9.1 | Hardcoding credentials in source | Use Named Credentials |
| 9.2 | REST methods not global/static | @RestResource requires global static methods |
| 10.1 | Running tests without `--test-level` | Production requires RunLocalTests |
| 10.2 | Destructive changes without empty package.xml | Both files must be deployed together |
