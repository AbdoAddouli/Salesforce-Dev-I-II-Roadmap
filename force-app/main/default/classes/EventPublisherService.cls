/*
 * ============================================================================
 * EventPublisherService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 5 & 11 - Platform Events (Publish / Subscribe)]
 *
 * WHAT THIS CLASS DOES:
 * Publishes Platform Events (Integration_Event__e) in BULK and provides a
 * small subscriber helper. The INTEGRATION_LOG_TRIGGER is a thin "after
 * insert" trigger that calls publishIntegrationEvents() so every integration
 * attempt is announced. A second trigger (IntegrationEventSubscriberTrigger)
 * subscribes on Integration_Event__e and creates Integration_Log__c rows,
 * closing the loop publisher -> event bus -> subscriber.
 *
 * WHY PLATFORM EVENTS:
 * Platform Events give us an event-driven, LOOSELY-COUPLED integration
 * channel:
 *   - The publisher does NOT wait for the subscriber (fire-and-forget).
 *   - Publishers and subscribers know nothing about each other.
 *   - EventBus.publish() returns a List<Database.SaveResult> one per event;
 *     a failed publish tells you the reason (e.g. Apex trigger error).
 *   - Low-volume events publish synchronously; the bus handles delivery.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. BULK publish - one EventBus.publish(list) call with N events. Do NOT
 *    loop-publish one at a time (publish counts towards the X DML limits).
 *
 * 2. SaveResult checking - published events can fail (quota, required field).
 *    Always inspect SaveResult.isSuccess() and surface failures.
 *
 * 3. `with sharing` - consistent sharing enforcement on the class surface.
 * ============================================================================
 */
public with sharing class EventPublisherService {

    /* ----------------------------------------------------------------------
     * publishIntegrationEvents(List<Integration_Log__c> logs)
     * ----------------------------------------------------------------------
     * Convert enqueued Integration Log rows into event records and publish
     * them in ONE call. Returns the number of events accepted by the bus.
     * ----------------------------------------------------------------------
     */
    public static Integer publishIntegrationEvents(
        List<Integration_Log__c> logs
    ) {
        if (logs == null || logs.isEmpty()) {
            return 0;
        }

        // Build one event per log row. Mapping fields 1:1 keeps the payload
        // self-describing for the subscriber trigger.
        List<Integration_Event__e> events = new List<Integration_Event__e>();
        for (Integration_Log__c log : logs) {
            events.add(
                new Integration_Event__e(
                    Source_Object__c = 'Integration_Log__c',
                    Direction__c = log.Direction__c,
                    Integration_Type__c = log.Integration_Type__c,
                    Status__c = log.Status__c,
                    Endpoint__c = log.Endpoint__c,
                    Correlation_Id__c = log.Correlation_Id__c,
                    Retry_Count__c = log.Retry_Count__c,
                    Payload__c = log.Request_Body__c
                )
            );
        }

        // SINGLE publish call for the whole list - bulk-friendly.
        List<Database.SaveResult> results = EventBus.publish(events);

        Integer accepted = 0;
        for (Database.SaveResult result : results) {
            if (result.isSuccess()) {
                accepted++;
            } else {
                System.debug(
                    'Event publish failed: ' + result.getErrors()
                );
            }
        }
        return accepted;
    }

    /* ----------------------------------------------------------------------
     * publishCodeReviewEvents(List<Code_Review__c> reviews)
     * ----------------------------------------------------------------------
     * Announce code-review decisions on the same event bus, reusing the exact
     * bulk pattern. Demonstrates that ONE subscriber trigger can listen for
     * different payload shapes without coupling the publishers.
     * ----------------------------------------------------------------------
     */
    public static Integer publishCodeReviewEvents(
        List<Code_Review__c> reviews
    ) {
        if (reviews == null || reviews.isEmpty()) {
            return 0;
        }
        List<Integration_Event__e> events = new List<Integration_Event__e>();
        for (Code_Review__c review : reviews) {
            events.add(
                new Integration_Event__e(
                    Source_Object__c = 'Code_Review__c',
                    Integration_Type__c = 'Platform Event',
                    Status__c = review.Review_Status__c,
                    Endpoint__c = review.Reviewed_Item__c,
                    Correlation_Id__c = review.Id,
                    Retry_Count__c = review.Changes_Requested__c
                )
            );
        }
        List<Database.SaveResult> results = EventBus.publish(events);
        Integer accepted = 0;
        for (Database.SaveResult result : results) {
            if (result.isSuccess()) {
                accepted++;
            }
        }
        return accepted;
    }
}