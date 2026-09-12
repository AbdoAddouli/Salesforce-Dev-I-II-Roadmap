/*
 * ============================================================================
 * AccountTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 4 - Triggers & Order of Execution]
 *
 * TRIGGER-LIGHT BEST PRACTICE:
 * This trigger does almost nothing itself - it just forwards the batch of
 * records to PerformanceService.normalizeHealthScores(). All business logic
 * lives in the service where it can be unit-tested in isolation.
 *
 * BEFORE-UPDATE + IN-MEMORY EDITS:
 * Fields changed on Trigger.new records in a BEFORE trigger are saved with
 * the original DML. No second `update` call needed - this is the cheapest
 * possible place to normalise data.
 *
 * BULKIFICATION:
 * We forward the WHOLE batch (Trigger.new) - never a single record - so the
 * service handles 1 or 200 records with the same code path.
 */
trigger AccountTrigger on Account (before update) {
    if (TriggerHandlerService.shouldRun('AccountTrigger')) {
        PerformanceService.normalizeHealthScores(Trigger.new);
    }
}