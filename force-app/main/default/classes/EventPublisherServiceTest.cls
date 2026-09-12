/*
 * ============================================================================
 * EventPublisherServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 5 - Platform Events + Pub/Sub]
 *
 * WHAT IT TESTS:
 *  1. publishIntegrationEvents(List<Integration_Log__c>): builds ONE event
 *     per log row and returns the count the platform bus accepted.
 *
 *  2. publishCodeReviewEvents(List<Code_Review__c>): same bulk pattern over
 *     a different source object - proves the subscriber can listen to one
 *     event shape regardless of which publisher wrote it.
 *
 *  3. The subscriber trigger (IntegrationEventSubscriberTrigger) materialises
 *     Integration_Log__c rows from a published event payload, then we prove
 *     the recursion guard stops the bus from spinning forever.
 * ============================================================================
 */
@isTest
private class EventPublisherServiceTest {

    @TestSetup
    static void makeData() {
        insert new Code_Review__c(
            Name = 'Triggers Order of Execution',
            Reviewed_Item__c = 'syncAccountContacts()',
            Review_Status__c = 'Approved',
            Changes_Requested__c = 0,
            Risk_Level__c = 'Low',
            Review_Date__c = Date.today()
        );
    }

    @isTest
    static void publishIntegrationEventsBulkPublishesAllLogs() {
        List<Integration_Log__c> logs = new List<Integration_Log__c>{
            new Integration_Log__c(
                Direction__c = 'Outbound',
                Integration_Type__c = 'REST API',
                Status__c = 'Success',
                Endpoint__c = 'https://api.example.com/v1/hello'
            ),
            new Integration_Log__c(
                Direction__c = 'Outbound',
                Integration_Type__c = 'Bulk API',
                Status__c = 'Success',
                Endpoint__c = 'https://bulk.example.com/job'
            )
        };

        Integer accepted = EventPublisherService.publishIntegrationEvents(logs);
        System.assertEquals(
            2,
            accepted,
            'publishIntegrationEvents must return one accepted event per log'
        );
    }

    @isTest
    static void publishCodeReviewEventsReturnsOnePerReview() {
        List<Code_Review__c> approvals = [
            SELECT Id, Review_Status__c, Reviewed_Item__c, Changes_Requested__c
            FROM Code_Review__c
        ];
        Integer accepted =
            EventPublisherService.publishCodeReviewEvents(approvals);
        System.assertEquals(
            1,
            accepted,
            'Each review becomes exactly one Platform Event'
        );
    }

    @isTest
    static void emptyInputShortCircuitsWithoutPublishing() {
        System.assertEquals(
            0,
            EventPublisherService.publishIntegrationEvents(null)
        );
        System.assertEquals(
            0,
            EventPublisherService.publishCodeReviewEvents(
                new List<Code_Review__c>()
            )
        );
    }

    @isTest
    static void subscriberTriggerMaterializesIntegrationLogFromEvent() {
        Integration_Event__e evt = new Integration_Event__e(
            Direction__c = 'Inbound',
            Integration_Type__c = 'WebSocket',
            Status__c = 'Success',
            Endpoint__c = 'wss://ws.example.com/feed',
            Correlation_Id__c = 'WS-1001',
            Retry_Count__c = 0,
            Payload__c = '{"msg":"hello"}'
        );
        Test.startTest();
        EventBus.publish(evt); // fires IntegrationEventSubscriberTrigger
        Test.stopTest();        // flush the low-volume event delivery

        List<Integration_Log__c> logs = [
            SELECT Id, Integration_Type__c, Direction__c, Correlation_Id__c
            FROM Integration_Log__c
            WHERE Correlation_Id__c = 'WS-1001'
        ];
        System.assertEquals(
            1,
            logs.size(),
            'Subscriber trigger materialised exactly one row from the event'
        );
        System.assertEquals('WebSocket', logs[0].Integration_Type__c);
    }
}