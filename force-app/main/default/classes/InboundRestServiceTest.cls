/*
 * ============================================================================
 * InboundRestServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 8 - REST API / @RestResource]
 *
 * WHAT IT TESTS:
 *  - @RestResource methods are static globals; we cannot pass RestRequest/
 *    RestResponse in Apex tests, so the pure-logic helpers are the
 *    correct test seam.
 *  - fetchRecentLogs: returns records with the desired limit.
 *  - createIntegrationLog: validates required field, returns record Id.
 *  - deleteIntegrationLog: correctly removes a row.
 *
 * [DESIGN NOTE]
 * InboundRestService exposes pure global static helpers that do the work.
 * The @HttpGet/@HttpPost/@HttpDelete methods set RestRequest/RestResponse
 * and delegate to these helpers. We test the helpers directly, which gives
 * us full coverage without framework fakes.
 * ============================================================================
 */
@isTest
private class InboundRestServiceTest {

    @TestSetup
    static void makeData() {
        List<Integration_Log__c> logs = new List<Integration_Log__c>();
        for (Integer i = 0; i < 5; i++) {
            logs.add(
                new Integration_Log__c(
                    Direction__c = 'Inbound',
                    Integration_Type__c = 'REST',
                    Status__c = 'Success',
                    Endpoint__c = 'https://api.example.com/log/' + i
                )
            );
        }
        insert logs;
    }

    @isTest
    static void fetchRecentLogsHonoursLimitAndReturnsRows() {
        List<Integration_Log__c> result =
            InboundRestService.fetchRecentLogs(3);
        System.assertEquals(
            3,
            result.size(),
            'fetchRecentLogs must return exactly the requested number of rows'
        );
    }

    @isTest
    static void createIntegrationLogReturnsIdAndSetsDirection() {
        Integration_Log__c incoming = new Integration_Log__c(
            Direction__c = 'Outbound',
            Integration_Type__c = 'REST',
            Status__c = 'Success'
        );
        Id createdId = InboundRestService.createIntegrationLog(incoming);
        System.assertNotEquals(null, createdId);

        Integration_Log__c saved = [
            SELECT Direction__c FROM Integration_Log__c WHERE Id = :createdId
        ];
        System.assertEquals(
            'Inbound',
            saved.Direction__c,
            'postRoute override must enforce Direction = Inbound'
        );
    }

    @isTest
    static void createIntegrationLogThrowsOnMissingType() {
        Integration_Log__c bad = new Integration_Log__c(Direction__c = 'Inbound');
        Exception caught;
        try {
            InboundRestService.createIntegrationLog(bad);
        } catch (InboundRestService.ValidationFailedException e) {
            caught = e;
        }
        System.assertNotEquals(
            null,
            caught,
            'Null Integration_Type__c must throw ValidationFailedException'
        );
    }

    @isTest
    static void deleteIntegrationLogRemovesTheRow() {
        Integration_Log__c target = [
            SELECT Id FROM Integration_Log__c LIMIT 1
        ];
        InboundRestService.deleteIntegrationLog(String.valueOf(target.Id));
        List<Integration_Log__c> remaining = [
            SELECT Id FROM Integration_Log__c WHERE Id = :target.Id
        ];
        System.assertEquals(
            0,
            remaining.size(),
            'Row must be deleted'
        );
    }
}