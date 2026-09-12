/*
 * ============================================================================
 * TriggerHandlerService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 4 - Triggers & Order of Execution]
 *
 * WHAT THIS CLASS DOES:
 * A minimal, readable TRIGGER FRAMEWORK. Every trigger in this repo delegates
 * to one service method. This class gives those triggers:
 *   1. a way to COORDINATE on which handler runs,
 *   2. RECURSION PREVENTION so a re-entrant DML does not re-fire the logic,
 *   3. readable context helpers so triggers stay "thin".
 *
 * WHY A FRAMEWORK:
 * A classic one-trigger-per-object best practice means the trigger body is
 * 20-ish lines that only DISPATCHES. All business logic lives in services.
 * Keeping recursion control in one place means each trigger does not need to
 * reinvent it.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. `inherited sharing` - honours the caller's sharing model. In a trigger
 *    context that is user context, so records respect the running user's
 *    sharing. Read Apex "sharing" docs: `inherited sharing` is the default
 *    recommended keyword for utility classes.
 *
 * 2. STATIC Map as a per-transaction registry. Apex has ONE static state per
 *    transaction, so `limits` survive across trigger/class calls in the same
 *    DML request. This is how recursion prevention works.
 *
 * 3. BYPASS pattern - a handler can be disabled for an explicit block of Apex
 *    (e.g. a batch that must mutate the same object without re-triggering).
 *
 * 4. Trigger context helpers - nice wrappers over Trigger.operationType so
 *    the three words "isBeforeInsert" tell a human instantly what fires.
 * ============================================================================
 */
public inherited sharing class TriggerHandlerService {

    /* Static registry: handler class names we intentionally suppressed. */
    public static final Map<String, Boolean> suppressedHandlers =
        new Map<String, Boolean>();

    /* Static registry: recursion guard - an Id we already processed. */
    public static final Set<Id> processedExternalIds = new Set<Id>();

    /* ----------------------------------------------------------------------
     * shouldRun(String handlerName)
     * ----------------------------------------------------------------------
     * True unless someone deliberately suppressed this handler.
     * Call at the top of each trigger body.
     * ----------------------------------------------------------------------
     */
    public static Boolean shouldRun(String handlerName) {
        return !suppressedHandlers.containsKey(handlerName);
    }

    /* ----------------------------------------------------------------------
     * suppress(String handlerName) / restore(String handlerName)
     * ----------------------------------------------------------------------
     * Temporarily disable a handler (usually around a controlled DML
     * performed by a batch or a service method that knows what it is doing).
     * ----------------------------------------------------------------------
     */
    public static void suppress(String handlerName) {
        suppressedHandlers.put(handlerName, true);
    }

    public static void restore(String handlerName) {
        suppressedHandlers.remove(handlerName);
    }

    /* ----------------------------------------------------------------------
     * markProcessed(Id) / hasProcessed(Id)
     * ----------------------------------------------------------------------
     * Recursion-prevention: remember an Id we already serviced so that a
     * second DML on the same record in this transaction is a no-op.
     * ----------------------------------------------------------------------
     */
    public static void markProcessed(Id recordId) {
        processedExternalIds.add(recordId);
    }

    public static Boolean hasProcessed(Id recordId) {
        return processedExternalIds.contains(recordId);
    }

    /* ----------------------------------------------------------------------
     * Context helpers - wrap Trigger.operationType/Trigger context vars.
     * A trigger calls e.g. TriggerHandlerService.isBeforeInsert().
     * ----------------------------------------------------------------------
     */
    public static Boolean isInsert() {
        return Trigger.operationType == System.TriggerOperation.BEFORE_INSERT ||
            Trigger.operationType == System.TriggerOperation.AFTER_INSERT;
    }

    public static Boolean isUpdate() {
        return Trigger.operationType == System.TriggerOperation.BEFORE_UPDATE ||
            Trigger.operationType == System.TriggerOperation.AFTER_UPDATE;
    }

    public static Boolean isDelete() {
        return Trigger.operationType == System.TriggerOperation.BEFORE_DELETE ||
            Trigger.operationType == System.TriggerOperation.AFTER_DELETE;
    }

    public static Boolean isBefore() {
        return Trigger.operationType == System.TriggerOperation.BEFORE_INSERT ||
            Trigger.operationType == System.TriggerOperation.BEFORE_UPDATE ||
            Trigger.operationType == System.TriggerOperation.BEFORE_DELETE ||
            Trigger.operationType == System.TriggerOperation.BEFORE_UNDELETE;
    }
}