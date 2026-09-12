/*
 * ============================================================================
 * IntegrationServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 11 - Direct integration callouts via httpCalloutMock]
 *
 * WHAT IT TESTS:
 *  - callOutbound() against a HttpCalloutMock: 200 => success + audit row,
 *  - the single retry on 5xx: first send 502, retry 200 => retried=true,
 *  - the audit Integration_Log__c row records the correlation id.
 *
 * WHY MOCKING:
 * The platform forbids REAL outbound traffic in tests. We implement the
 * HttpCalloutMock interface (HttpRequest in, HttpResponse out) and install it
 * with Test.setMock(HttpCalloutMock.class, mock). Every http.send() the
 * service performs is served by our scripted response - no network involved.
 * ============================================================================
 */
@isTest
private class IntegrationServiceTest {

    private class MockRetryable implements HttpCalloutMock {
        private Integer attempts = 0;
        public HttpResponse respond(HttpRequest req) {
            attempts++;
            HttpResponse res = new HttpResponse();
            // first call returns 502 (transient), retry returns 200
            res.setStatusCode(attempts == 1 ? 502 : 200);
            res.setBody('{"attempt":' + attempts + '}');
            res.setHeader('Content-Type', 'application/json');
            return res;
        }
    }

    @isTest
    static void callOutboundSucceedsAgainst2xxMock() {
        Test.setMock(HttpCalloutMock.class, new MockRetryable());
        Test.startTest();
        IntegrationService.CalloutResult outcome =
            IntegrationService.callOutbound('GET', '/health', null);
        Test.stopTest();

        // First response was 502 so the single retry recovered to 200.
        System.assert(outcome.success);
        System.assert(outcome.retried);
        System.assertEquals(200, outcome.statusCode);
        System.assertEquals('{"attempt":2}', outcome.body);
    }

    @isTest
    static void callOutboundLogsAuditRowWithCorrelationId() {
        Test.setMock(HttpCalloutMock.class, new MockRetryable());
        Test.startTest();
        IntegrationService.CalloutResult outcome =
            IntegrationService.callOutbound('POST', '/health', '{"v":1}');
        Test.stopTest();

        System.assert(outcome.success);
        System.assertNotEquals(null, outcome.correlationId);

        Integration_Log__c audit = [
            SELECT Id, Direction__c, Status__c, Retry_Count__c,
                   Correlation_Id__c, Http_Method__c, Request_Body__c
            FROM Integration_Log__c
            LIMIT 1
        ];
        System.assertEquals('Outbound', audit.Direction__c);
        System.assertEquals('Success', audit.Status__c);
        System.assertEquals(1, audit.Retry_Count__c);
        System.assertEquals('POST', audit.Http_Method__c);
        System.assertEquals('{"v":1}', audit.Request_Body__c);
        System.assertEquals(outcome.correlationId, audit.Correlation_Id__c);
    }

    @isTest
    static void correlationIdIsStableAcrossRetries() {
        String id1 = IntegrationService.generateCorrelationId();
        String id2 = IntegrationService.generateCorrelationId();
        System.assertNotEquals(id1, id2, 'Correlation ids must differ');
        System.assertEquals(
            6,
            id1.split('-')[0].length(),
            'Prefix is the current user id (first 6 chars)'
        );
    }
}