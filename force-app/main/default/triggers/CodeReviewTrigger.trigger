/*
 * ============================================================================
 * CodeReviewTrigger
 * ============================================================================
 * [LEARNING FOCUS: Phase 5 - Change detection + event broadcast]
 *
 * AFTER-UPDATE + FIELD-CHANGE GUARD:
 * We only want to announce a review when its decision actually changed
 * (Approved__c toggled / Review_Status__c moved). Comparing
 * Trigger.oldMap[rec.Id].Review_Status__c vs the new value is the canonical
 * way to react to *changes*, not just to any update.
 *
 * Delegation: EventPublisherService.publishCodeReviewEvents converts the
 * changed rows into Integration_Event__e publications in one bulk call.
 */
trigger CodeReviewTrigger on Code_Review__c (after update) {
    if (!TriggerHandlerService.shouldRun('CodeReviewTrigger')) {
        return;
    }

    List<Code_Review__c> changed = new List<Code_Review__c>();
    for (Code_Review__c review : Trigger.new) {
        Code_Review__c old = Trigger.oldMap.get(review.Id);
        if (review.Review_Status__c != old.Review_Status__c ||
            review.Approved__c != old.Approved__c) {
            changed.add(review);
        }
    }

    if (!changed.isEmpty()) {
        EventPublisherService.publishCodeReviewEvents(changed);
    }
}