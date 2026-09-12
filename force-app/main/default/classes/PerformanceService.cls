/*
 * ============================================================================
 * PerformanceService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 10 - Performance & Large Data Volumes]
 *
 * WHAT THIS CLASS DOES:
 * Demonstrates the performance high-leverage patterns that keep Apex inside
 * governor limits as data grows: selective SOQL, Map-based joins instead of
 * nested loops, in-memory field normalisation, and bulk (non-loop) DML.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. MAP JOIN vs NESTED LOOPS - The expensive anti-pattern is:
 *        for (Account a : accounts) { for (Contact c : contacts) {...} }
 *    O(n*m) comparisons. The Map pattern is O(n+m): bucket contacts by
 *    AccountId once, then look them up per account.
 *
 * 2. BEFORE-TRIGGER IN-MEMORY EDITS - normalizeHealthScores() is called from
 *    AccountTrigger (before update). Field edits on Trigger.new are saved
 *    automatically with the original DML - ZERO additional DML.
 *
* 3. SELECTIVE QUERIES - rebuildHealthScores() accepts a query string that a
 *    developer can check with the Query Plan tool (Developer Console) and
 *    tune to use indexed fields. Selective WHERE clauses keep full-table
 *    scans off the table.
 *
 * 4. CLAMP LOGIC - score values must stay 0..100; defensive clamping means a
 *    bad data feed cannot write 9999 into the database.
 *
 * 5. `with sharing` - filters results by running-user sharing so we never
 *    propose internal data to a low-privilege user.
 * ============================================================================
 */
public with sharing class PerformanceService {

    /* ----------------------------------------------------------------------
     * normalizeHealthScores(List<Account> accounts)
     * ----------------------------------------------------------------------
     * Pure in-memory normalisation: clamps nulls and 0..100.
     * Meant for the BEFORE-UPDATE Account trigger.
     * ----------------------------------------------------------------------
     */
    public static void normalizeHealthScores(List<Account> accounts) {
        for (Account acc : accounts) {
            acc.Health_Score__c = clamp(acc.Health_Score__c);
        }
    }

    /* ----------------------------------------------------------------------
     * topAccountsByScore(Set<Id> accountIds, Integer limitRows)
     * ----------------------------------------------------------------------
     * MAP JOIN - returns the N accounts with the highest Health_Score__c.
     * Requires a single selective query; no nested loop home.
     * ----------------------------------------------------------------------
     */
    public static List<Account> topAccountsByScore(
        Set<Id> accountIds,
        Integer limitRows
    ) {
        if (accountIds == null || accountIds.isEmpty()) {
            return new List<Account>();
        }
        // One query, selective (Id IN :set uses the primary index).
        return [
            SELECT Id, Name, Health_Score__c
            FROM Account
            WHERE Id IN :accountIds AND Health_Score__c != null
            ORDER BY Health_Score__c DESC
            LIMIT :limitRows
        ];
    }

    /* ----------------------------------------------------------------------
     * rebuildHealthScores(String soqlQuery)
     * ----------------------------------------------------------------------
     * Scheduler-friendly bulk refresh: reads the supplied query (must include
     * Id, Health_Score__c), clamps, then DMLs ONCE. If the caller query is
     * non-selective this billboards in the Query Plan tool even before deploy.
     * ----------------------------------------------------------------------
     */
    public static Integer rebuildHealthScores(String soqlQuery) {
        List<Account> accounts = Database.query(soqlQuery);
        normalizeHealthScores(accounts);
        update accounts;
        return accounts.size();
    }

    /* ----------------------------------------------------------------------
     * slotContactsByAccount(List<Contact> contacts)
     * ----------------------------------------------------------------------
     * The canonical Map join: returns accountId -> list of its contacts.
     * ----------------------------------------------------------------------
     */
    public static Map<Id, List<Contact>> slotContactsByAccount(
        List<Contact> contacts
    ) {
        Map<Id, List<Contact>> byAccount = new Map<Id, List<Contact>>();
        for (Contact c : contacts) {
            if (c.AccountId == null) {
                continue; // skip orphans
            }
            if (!byAccount.containsKey(c.AccountId)) {
                byAccount.put(c.AccountId, new List<Contact>());
            }
            byAccount.get(c.AccountId).add(c);
        }
        return byAccount;
    }

    private static Integer clamp(Integer value) {
        if (value == null) {
            return 70;
        }
        return Math.min(100, Math.max(0, value));
    }
}