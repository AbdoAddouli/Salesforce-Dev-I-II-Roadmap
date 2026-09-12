/*
 * ============================================================================
 * SecurityServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 9 - Apex Security & Sharing]
 *
 * WHAT IT TESTS:
 *  - CRUD describe checks (the running admin user passes every guard),
 *  - FLS field describe,
 *  - stripInaccessible filtering to readable fields,
 *  - APEX MANAGED SHARING: share a Code_Review__c (OWD=Private) with a
 *    separate test User, confirm the Code_Review__Share row exists, then
 *    deleteShare() removes it.
 *
 * KEY PATTERN:
 * Managed sharing is only meaningful on an object whose OWD is Private or
 * Public Read Only. Code_Review__c OWD is Private (see object-meta.xml), so
 * a _Share row is the ONLY way an outside user gains access.
 * ============================================================================
 */
@isTest
private class SecurityServiceTest {

    @TestSetup
    static void makeData() {
        insert new Code_Review__c(
            Name = 'Final PR Review',
            Reviewed_Item__c = 'AccountTrigger handler',
            Review_Status__c = 'Needs Work',
            Changes_Requested__c = 3,
            Risk_Level__c = 'Medium',
            Review_Date__c = Date.today()
        );
    }

    @isTest
    static void assertCanAccessPassesForAdminOnRead() {
        // System Admin in a test passes the guard without exception.
        SecurityService.assertCanAccess(
            Schema.SObjectType.Code_Review__c,
            SecurityService.SecurityAccess.READ
        );
    }

    @isTest
    static void fieldDescribeReflectsRunningUserFls() {
        Boolean visible = SecurityService.isFieldAccessible(
            Schema.SObjectType.Integration_Log__c.fields.Direction__c
        );
        System.assert(visible);
    }

    @isTest
    static void stripToReadableKeepsTheRecordShape() {
        List<Integration_Log__c> logs = [
            SELECT Id, Name, Direction__c, Request_Body__c
            FROM Integration_Log__c
            LIMIT 1
        ];
        List<SObject> readable = SecurityService.stripToReadable(logs);
        System.assertEquals(1, readable.size());
        System.assert(
            readable[0] instanceof Integration_Log__c,
            'stripInaccessible keeps the SObject type, removes access'
        );
    }

    @isTest
    static void managedSharingGrantThenDeleteRoundTrips() {
        Code_Review__c review = [SELECT Id FROM Code_Review__c LIMIT 1];

        Profile p = [
            SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1
        ];
        User partner = new User(
            FirstName = 'Review',
            LastName = 'Partner',
            Alias = 'rpart',
            Email = 'review.partner@example.com',
            Username = 'review.partner@example.com' +
                System.currentTimeMillis(),
            CommunityNickname = 'rpartner',
            TimeZoneSidKey = 'America/New_York',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            ProfileId = p.Id
        );
        insert partner;

        Test.startTest();
        SecurityService.shareCodeReview(review.Id, partner.Id, 'Read');
        Test.stopTest();

        List<Code_Review__Share> shares = [
            SELECT Id
            FROM Code_Review__Share
            WHERE ParentId = :review.Id AND UserOrGroupId = :partner.Id
        ];
        System.assertEquals(
            1,
            shares.size(),
            'Managed sharing row was created for the reviewer'
        );

        Test.startTest();
        SecurityService.deleteShare(shares[0].Id);
        Test.stopTest();

        List<Code_Review__Share> remaining = [
            SELECT Id
            FROM Code_Review__Share
            WHERE Id = :shares[0].Id
        ];
        System.assertEquals(
            0,
            remaining.size(),
            'deleteShare removes the row from Code_Review__Share'
        );
    }
}