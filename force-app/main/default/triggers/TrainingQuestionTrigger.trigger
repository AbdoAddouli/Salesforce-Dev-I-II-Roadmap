/*
 * ============================================================================
 * TrainingQuestionTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 2 & 13 - before-save data integrity]
 *
 * BEFORE INSERT/UPDATE on the question bank keeps every stored question
 * clean: trimmed question text, a default 'A' answer, a default difficulty.
 * All in-memory edits; saved automatically with the DML.
 *
 * Delegation: CertificationPrepService.sanitizeTrainingQuestions.
 */
trigger TrainingQuestionTrigger on Training_Question__c (
    before insert,
    before update
) {
    if (TriggerHandlerService.shouldRun('TrainingQuestionTrigger')) {
        CertificationPrepService.sanitizeTrainingQuestions(Trigger.new);
    }
}