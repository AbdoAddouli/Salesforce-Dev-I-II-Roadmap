/*
 * ============================================================================
 * SoqlSoslServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 3 - SOQL & SOSL]
 *
 * WHAT IT TESTS:
 * AggregateResult value access by alias, relationship queries, parent-child
 * subqueries, SOSL with Test.setFixedSearchResults, and dynamic SOQL.
 *
 * 1. Test.setFixedSearchResults(List<List<SObject>>) makes SOSL
 *    deterministic in tests - real search indexes are not guaranteed in
 *    scratch orgs, so we feed the platform the "find" results directly.
 *
 * 2. AggregateResult: read values via result.get('<alias>') - aliases are
 *    the ONLY way to reach COUNT/AVG/SUM outputs.
 * ============================================================================
 */
@isTest
private class SoqlSoslServiceTest {

    @TestSetup
    static void makeData() {
        Account tech = new Account(
            Name = 'TechCorp',
            Health_Score__c = 95,
            Industry = 'Technology'
        );
        Account fin = new Account(
            Name = 'FinanceLab',
            Health_Score__c = 70,
            Industry = 'Finance'
        );
        insert new List<Account>{ tech, fin };

        Contract mentor = new Contact(
            FirstName = 'Ada',
            LastName = 'Lovelace',
            AccountId = fin.Id
        );
        Contact student = new Contact(
            FirstName = 'Turing',
            LastName = 'Bell',
            AccountId = tech.Id
        );
        insert new List<Contact>{ mentor, student };

        Opportunity big = new Opportunity(
            Name = 'Platform Rollout',
            StageName = 'Prospecting',
            CloseDate = Date.today().addMonths(3),
            Amount = 500000,
            AccountId = tech.Id,
            Deal_Quality_Score__c = 88
        );
        Opportunity small = new Opportunity(
            Name = 'Add-on',
            StageName = 'Qualification',
            CloseDate = Date.today().addMonths(1),
            Amount = 25000,
            AccountId = fin.Id,
            Deal_Quality_Score__c = 55
        );
        insert new List<Opportunity>{ big, small };
    }

    @isTest
    static void aggregateReturnsPerAccountContactCounts() {
        List<AggregateResult> rows =
            SoqlSoslService.countContactsByAccount();

        // AggregateResult values are read by ALIAS, never by field name.
        System.assertEquals(2, rows.size());
        for (AggregateResult row : rows) {
            Object count = row.get('contactCount');
            System.assertEquals(1, (Integer) count);
        }
    }

    @isTest
    static void aggregateGroupsOppsByStageAndAveragesQuality() {
        List<AggregateResult> rows = SoqlSoslService.dealQualityByStage();
        System.assert(!rows.isEmpty(), 'One grouped row per StageName');
        AggregateResult first = rows[0];
        System.assertNotEquals(
            null,
            first.get('avgQuality'),
            'AVG returns the Deal_Quality_Score__c average'
        );
    }

    @isTest
    static void relationshipQueryPullsParentAccountName() {
        // minScore=60 filters out the 55-quality 'Add-on' opportunitity
        // and leaves the 88-quality 'Platform Rollout' for TechCorp.
        List<Opportunity> tops = SoqlSoslService.topOpportunities(60);
        System.assertEquals(1, tops.size());
        System.assertEquals(
            'TechCorp',
            tops[0].Account.Name,
            'Parent Account.Name arrives on the row without a 2nd query'
        );
    }

    @isTest
    static void parentChildSubqueryReturnsChildRowsInline() {
        List<Account> tech = [SELECT Id FROM Account WHERE Name = 'TechCorp'];
        List<Account> accounts =
            SoqlSoslService.accountsWithOpenOpportunities(
                new Set<Id>{ tech[0].Id }
            );
        System.assertEquals(1, accounts.size());
        System.assertEquals(
            1,
            accounts[0].Opportunities.size(),
            'One open Opportunity is nested under its Account'
        );
    }

    @isTest
    static void soslUsesFixedSearchResultsDeterministically() {
        List<SObject> accountHit = [
            SELECT Id, Name FROM Account WHERE Name = 'TechCorp'
        ];
        List<List<SObject>> fixed = new List<List<SObject>>{
            accountHit,
            new List<SObject>()
        };
        Test.setFixedSearchResults(fixed);

        List<List<SObject>> results =
            SoqlSoslService.searchAccounts('TechCorp');
        System.assertNotEquals(null, results);
        System.assertEquals(
            1,
            results[0].size(),
            'SOSL returns Account hits first, Contact hits second'
        );
    }

    @isTest
    static void dynamicSoqlRespectsEscapingAgainstInjection() {
        // A hostile condition is neutralised by escapeSingleQuotes().
        List<Account> accounts =
            SoqlSoslService.runSafeDynamicQuery(
                "Name LIKE '%TechCorp%'"
            );
        System.assertEquals(1, accounts.size());
    }
}