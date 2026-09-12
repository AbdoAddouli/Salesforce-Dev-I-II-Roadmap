/*
 * ============================================================================
 * LwcDataServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 8 - Apex controllers for LWC (@wire + imperative)]
 *
 * WHAT IT TESTS:
 *  - the cacheable @wire-style read (getAccountsWithContacts),
 *  - the cacheable quiz selector (getQuestionsByDomain),
 *  - the imperative DML write (recordStudyProgress) which updates and returns
 *    the freshest row in one round trip.
 *
 * NOTE ON TESTING @AuraEnabled:
 * Aura/LWC methods cannot be invoked through the framework inside Apex tests;
 * we call them as plain static methods. FLS/CRUD and governor limits are still
 * enforced exactly as they would be for a real component call.
 * ============================================================================
 */
@isTest
private class LwcDataServiceTest {

    @TestSetup
    static void makeData() {
        insert new List<Account>{
            new Account(Name = 'LWC Alpha', Health_Score__c = 80),
            new Account(Name = 'LWC Beta', Health_Score__c = 65),
            new Account(Name = 'LWC Gamma', Health_Score__c = 50)
        };
        insert new Training_Question__c(
            Name = 'Quiz Q1',
            Question_Text__c = 'What is a picklist?',
            Answer_Option_A__c = 'A constrained list of values',
            Answer_Option_B__c = 'A currency field',
            Correct_Answer__c = 'A',
            Difficulty__c = 'Easy',
            Exam_Domain__c = 'Developer Fundamentals',
            Certification_Target__c = 'Platform Developer I',
            Is_Active__c = true
        );
    }

    @isTest
    static void cachedWireStyleReadReturnsAccountsSortedByName() {
        List<Account> accounts = LwcDataService.getAccountsWithContacts();
        System.assertEquals(3, accounts.size());
        System.assertEquals(
            'LWC Alpha',
            accounts[0].Name,
            'ORDER BY Name keeps the list alphabetical'
        );
    }

    @isTest
    static void cachedQuizSelectorFiltersByDomain() {
        List<Training_Question__c> questions =
            LwcDataService.getQuestionsByDomain('Developer Fundamentals');
        System.assertEquals(1, questions.size());
        System.assertEquals(
            'Developer Fundamentals',
            questions[0].Exam_Domain__c
        );
    }

    @isTest
    static void imperativeDmlWithoutCacheableUpdatesAndReturnsState() {
        Account target = [
            SELECT Id FROM Account WHERE Name = 'LWC Beta'
        ];
        Contact mentor = new Contact(
            FirstName = 'Ada',
            LastName = 'Lovelace',
            AccountId = target.Id
        );
        insert mentor;

        // recordStudyProgress needs a Study_Plan__c row keyed to the user.
        Id learnerId = UserInfo.getUserId();
        CertificationPrepService.buildStudyPlan(
            learnerId,
            'Platform Developer I',
            Date.today().addMonths(6)
        );
        Study_Plan__c plan = [
            SELECT Id FROM Study_Plan__c
            WHERE Phase_Number__c = 1
            LIMIT 1
        ];

        Study_Plan__c updated = LwcDataService.recordStudyProgress(
            plan.Id,
            12
        );
        System.assertEquals(12, updated.Completed_Lessons__c);
        System.assertEquals(1, updated.Phase_Number__c);
    }
}