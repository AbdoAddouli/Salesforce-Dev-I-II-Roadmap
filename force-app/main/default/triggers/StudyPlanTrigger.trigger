/*
 * ============================================================================
 * StudyPlanTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 13 - before-insert defaults]
 *
 * BEFORE INSERT: new Study_Plan__c rows start at Phase 1, 'Not Started' with
 * today as Start_Date. Kept to pure defaults so the user cannot corrupt a
 * brand-new plan. Business rules stay in CertificationPrepService.
 */
trigger StudyPlanTrigger on Study_Plan__c (before insert) {
    if (TriggerHandlerService.shouldRun('StudyPlanTrigger')) {
        CertificationPrepService.initializeStudyPlans(Trigger.new);
    }
}