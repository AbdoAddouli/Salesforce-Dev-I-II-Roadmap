/*
 * ============================================================================
 * PerformanceServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 10 - Performance patterns]
 *
 * WHAT IT TESTS:
 *  - in-memory clamp via the BEFORE-UPDATE trigger path (no extra DML),
 *  - the Map-join slotting algorithm (contact buckets),
 *  - bulk rebuild issued over an arbitrary query string.
 * ============================================================================
 */
@isTest
private class PerformanceServiceTest {

    @TestSetup
    static void makeData() {
        Account breakingAccount = new Account(
            Name = 'Bad Scores Corp',
            Health_Score__c = 150 // violates 0..100 by design
        );
        Account nullAccount = new Account(
            Name = 'No Health Yay',
            Health_Score__c = null
        );
        Account fineAccount = new Account(
            Name = 'Fine Co',
            Health_Score__c = 42
        );
        Account sandbox = new Account(Name = 'Sandbox Co', Health_Score__c = 88);
        insert new List<Account>{
            breakingAccount,
            nullAccount,
            fineAccount,
            sandbox
        };
    }

    @isTest
    static void triggerPathClampsScoresOnBeforeUpdate() {
        List<Account> all = [SELECT Name, Health_Score__c FROM Account];
        List<Account> toClamp = new List<Account>();
        for (Account a : all) {
            a.Health_Score__c = 250; // force a bad feed value
            toClamp.add(a);
        }

        // This is EXACTLY what AccountTrigger runs (Phase 4): in-memory edits
        // in a BEFORE trigger, then the platform saves them with the update.
        PerformanceService.normalizeHealthScores(toClamp);
        update toClamp;

        List<Account> after = [SELECT Health_Score__c FROM Account];
        for (Account a : after) {
            System.assert(
                a.Health_Score__c == null ||
                (a.Health_Score__c >= 0 && a.Health_Score__c <= 100),
                'Every score must live inside 0..100 after the trigger'
            );
        }
    }

    @isTest
    static void mapJoinBucketsContactsByAccountId() {
        Account a = [SELECT Id FROM Account WHERE Name = 'Fine Co'];
        Contact c1 = new Contact(LastName = 'One', AccountId = a.Id);
        Contact c2 = new Contact(LastName = 'Two', AccountId = a.Id);
        Contact orphan = new Contact(LastName = 'Lone', AccountId = null);
        insert new List<Contact>{ c1, c2, orphan };

        Map<Id, List<Contact>> buckets =
            PerformanceService.slotContactsByAccount(
                new List<Contact>{ c1, c2, orphan }
            );

        // Orphan is skipped; the two slotted contacts share one bucket key.
        System.assertEquals(1, buckets.size());
        System.assertEquals(2, buckets.get(a.Id).size());
    }

    @isTest
    static void rebuildBulkClampsAndUpdatesInOneStatement() {
        Integer touched = PerformanceService.rebuildHealthScores(
            'SELECT Id, Health_Score__c FROM Account'
        );
        System.assertEquals(4, touched);

        List<Account> after = [SELECT Health_Score__c FROM Account];
        for (Account a : after) {
            System.assert(a.Health_Score__c <= 100);
        }
    }
}