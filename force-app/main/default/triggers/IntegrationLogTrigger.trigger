/*
 * ============================================================================
 * IntegrationLogTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 5 & 11 - Platform Events]
 *
 * AFTER-INSERT correct choice: a new Integration_Log__c row should ALSO be
 * announced on the event bus so subscriber processes react. The AFTER phase
 * guarantees the record is already committed, so we can safely publish.
 *
 * The trigger body is one line of delegation - every extra line here would be
 * business logic that could not be unit-tested. Publish logic lives in
 * EventPublisherService.
 */
trigger IntegrationLogTrigger on Integration_Log__c (after insert) {
    if (TriggerHandlerService.shouldRun('IntegrationLogTrigger')) {
        EventPublisherService.publishIntegrationEvents(Trigger.new);
    }
}