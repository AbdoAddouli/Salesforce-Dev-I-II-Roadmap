/*
 * ============================================================================
 * IntegrationEventSubscriberTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 11 - Publish / Subscribe, loosely coupled systems]
 *
 * WHY THIS TRIGGER EXISTS:
 * Platform events let us glue external tools to Salesforce without polluting
 * the publisher's transaction. This subscriber reacts to Integration_Event__e
 * publications and MATERIALISES them into Integration_Log__c rows so they
 * show up in reports and dashboards.
 *
 * PLATFORM-EVENT TRIGGER SEMANTICS:
 *  - Platform-event triggers fire only in the AFTER-INSERT context.
 *  - The org "saves" events to the bus; subscriber triggers run asynchronously
 *    from the publisher's perspective (or synchronously for low volume).
 *  - Never create platform-event subscribers that call out to that same
 *    event, or you can build an infinite loop - guard the work with the
 *    TriggerHandlerService recursion set if you ever cross object boundaries.
 *
 * Delegation is intentionally inline-light: converting fields 1:1 is data
 * mapping, which stays readable inside a short trigger body.
 */
trigger IntegrationEventSubscriberTrigger on Integration_Event__e (
    after insert
) {
    if (!TriggerHandlerService.shouldRun('IntegrationEventSubscriberTrigger')) {
        return;
    }

    List<Integration_Log__c> logs = new List<Integration_Log__c>();
for (Integration_Event__e evt : Trigger.new) {
            logs.add(
                new Integration_Log__c(
                    Direction__c = evt.Direction__c ?: 'Inbound',
                    Integration_Type__c = evt.Integration_Type__c,
                    Status__c = evt.Status__c ?: 'Success',
                    Endpoint__c = evt.Endpoint__c,
                    Correlation_Id__c = evt.Correlation_Id__c,
                    Retry_Count__c = evt.Retry_Count__c,
                    Request_Body__c = evt.Payload__c,
                    Succeeded__c = String.isNotBlank(evt.Status__c) &&
                        evt.Status__c != 'Failed'
                )
            );
        }

        // RECURSION GUARD: the logs we are about to insert would otherwise
        // republish Integration_Event__e (author loop). Suppress the
        // publisher for this controlled insert, then restore it.
        if (!logs.isEmpty()) {
            TriggerHandlerService.suppress('IntegrationLogTrigger');
            insert logs; // single bulk DML
            TriggerHandlerService.restore('IntegrationLogTrigger');
        }
    }
}
    insert logs; // single bulk DML
}