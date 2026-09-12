/*
 * ============================================================================
 * LwcDataService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 8 - Lightning Web Components (@wire + Imperative)]
 *
 * WHAT THIS CLASS DOES:
 * The Apex controllers that an LWC calls. Two call-styles are demonstrated:
 *   1. @AuraEnabled(cacheable=true)  -> used WITH @wire on the client. The
 *      "wire" service streams the record into the component and keeps it in
 *      sync; NO network traffic for repeat calls. cacheable=true means no
 *      DML is allowed inside.
 *   2. @AuraEnabled (without cacheable) -> used for IMPERATIVE calls, i.e.
 *      the client explicitly imports the method and awaits it. This elbow
 *      is the one that may perform DML.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. `with sharing` + describe security - every method only returns records
 *    the running user may see. For extra paranoia we also blast fields
 *    through Schema.getGlobalDescribe() checks (a PDII habit); the strip
 *    alternative is SObjectAccessDecision.
 *
 * 2. Apex always passes typed SObject lists back; a cacheable method may not
 *    throw a user-visible error, so we return empty lists instead of nulls.
 *
 * 3. Endpoint methods on the class surface must be `public static` when the
 *    client controller is an Aura/LWC export.
 *
 * 4. Non-cacheable imperative "command" methods may update and return the
 *    resulting state, giving the client a single round-trip.
 * ============================================================================
 */
public with sharing class LwcDataService {

    /* ----------------------------------------------------------------------
     * getAccountsWithContacts()
     * ----------------------------------------------------------------------
     * CACHEABLE - fine for @wire. Returns Account parent + first Contacts.
     * ----------------------------------------------------------------------
     */
    @AuraEnabled(cacheable=true)
    public static List<Account> getAccountsWithContacts() {
        if (!Schema.SObjectType.Account.isAccessible() ||
            !Schema.SObjectType.Contact.isAccessible()) {
            return new List<Account>();
        }
        return [
            SELECT Id, Name, Health_Score__c, Industry,
                   (SELECT Id, Name, Email FROM Contacts ORDER BY Name LIMIT 3)
            FROM Account
            ORDER BY Name
            LIMIT 20
        ];
    }

    /* ----------------------------------------------------------------------
     * getQuestionsByDomain(String domain)
     * ----------------------------------------------------------------------
     * CACHEABLE resource for the Quiz engine: filters Training_Question__c.
     * ----------------------------------------------------------------------
     */
    @AuraEnabled(cacheable=true)
    public static List<Training_Question__c> getQuestionsByDomain(
        String domain
    ) {
        if (!Schema.SObjectType.Training_Question__c.isAccessible()) {
            return new List<Training_Question__c>();
        }
        // Bind, never concatenate: the domain string is user-driven.
        return [
            SELECT Id, Question_Text__c, Answer_Option_A__c, Answer_Option_B__c,
                   Answer_Option_C__c, Answer_Option_D__c, Answer_Option_E__c,
                   Correct_Answer__c, Explanation__c, Certification_Target__c
            FROM Training_Question__c
            WHERE Is_Active__c = true AND Exam_Domain__c = :domain
            ORDER BY Name
            LIMIT 50
        ];
    }

    /* ----------------------------------------------------------------------
     * recordStudyProgress(Id planId, Integer completedLessons)
     * ----------------------------------------------------------------------
     * IMPERATIVE (non-cacheable) - allowed to perform DML. Returns the
     * updated phase so the client can re-render without a second query.
     * ----------------------------------------------------------------------
     */
    @AuraEnabled
    public static Study_Plan__c recordStudyProgress(
        Id planId,
        Integer completedLessons
    ) {
        Study_Plan__c plan = new Study_Plan__c(
            Id = planId,
            Completed_Lessons__c = completedLessons
        );
        if (!Schema.SObjectType.Study_Plan__c.isUpdateable()) {
            throw new AuraHandledException(
                'You are not allowed to update study plans.'
            );
        }
        update plan;
        // Return the freshest state in one round-trip.
        return [
            SELECT Id, Name, Phase_Number__c, Completed_Lessons__c, Progress__c
            FROM Study_Plan__c
            WHERE Id = :planId
            LIMIT 1
        ];
    }
}