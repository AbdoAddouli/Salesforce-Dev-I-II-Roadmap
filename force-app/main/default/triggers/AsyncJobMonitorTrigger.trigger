/*
 * ============================================================================
 * AsyncJobMonitorTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 5 - Async Apex governance]
 *
 * BEFORE-INSERT hook that fills a new Async_Job_Monitor__c row with sane
 * defaults (Queued status + Started timestamp) entirely in-memory. Edits here
 * ride along with the original insert - zero extra DML.
 *
 * Delegation: the defaults live in AsyncJobService.initializeMonitors.
 */
trigger AsyncJobMonitorTrigger on Async_Job_Monitor__c (before insert) {
    if (TriggerHandlerService.shouldRun('AsyncJobMonitorTrigger')) {
        AsyncJobService.initializeMonitors(Trigger.new);
    }
}