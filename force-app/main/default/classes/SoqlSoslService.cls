/*
 * ============================================================================
 * SoqlSoslService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 3 - SOQL & SOSL]
 *
 * WHAT THIS CLASS DOES:
 * A "read-path" service that centralises every query in this lab so that
 * parent-child relations, aggregates, dynamic SOQL and SOSL are all shown in
 * one place -- and always from an explicit, repeating set of queries so you
 * can compare them line by line.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. Aggregates with GROUP BY  -> Apex returns each group as an
 *    AggregateResult row. You access values by ALIAS, e.g. cnt,
 *    because you cannot use the raw field name.
 *
 * 2. Relationship queries       -> "SELECT Account.Name FROM Opportunity"
 *    lets you pull parent fields WITHOUT a second query. This is one
 *    (cheap) SOQL statement, not two. Avoid placing SOQL inside for loops.
 *
 * 3. Parent-child subqueries    -> "SELECT (SELECT Id FROM Opportunities)"
 *    pulls up to the first of 200 child rows per parent. Children arrive in
 *    a List<SObject> on the parent record (Opportunities).
 *
 * 4. Dynamic SOQL injection     -> String.fromTimestamp and variable binding
 *    via :var is safer than concatenating user input. We show both a safe
 *    bind example and a deliberate concatenation warning.
 *
 * 5. SOSL                       -> fuzzy search across MULTIPLE objects at
 *    once. Each result is a List<List<SObject>>: one List per searched
 *    object type, ordered the same way you listed the object types.
 *
 * 6. `with sharing`             -> running-user's sharing rules are enforced
 *    for the queries in this class. Read-only by design.
 * ============================================================================
 */
public with sharing class SoqlSoslService {

    /* ----------------------------------------------------------------------
     * countContactsByAccount()
     * ----------------------------------------------------------------------
     * AGGREGATE QUERY - counts contacts per account.
     * Note the SELECT goes into AggregateResult; ALIASES make values readable.
     * Best practice: alias with `alias ['something intuitive']`.
     * ----------------------------------------------------------------------
     */
    public static List<AggregateResult> countContactsByAccount() {
        // GROUP BY AccountId => one row per account.
        // WHERE Contact.AccountId is NOT NULL excludes orphans.
        return [
            SELECT AccountId, COUNT(Id) contactCount
            FROM Contact
            WHERE AccountId != null
            GROUP BY AccountId
            ORDER BY COUNT(Id) DESC
            LIMIT 10
        ];
    }

    /* ----------------------------------------------------------------------
     * dealQualityByStage()
     * ----------------------------------------------------------------------
     * AGGREGATE QUERY over OPPORTUNITY grouped by the standard StageName.
     * Demonstrates AVG() and SUM() aliases on the custom Deal_Quality_Score__c.
     * ----------------------------------------------------------------------
     */
    public static List<AggregateResult> dealQualityByStage() {
        return [
            SELECT StageName, AVG(Deal_Quality_Score__c) avgQuality,
                   SUM(Amount) pipelineAmount
            FROM Opportunity
            WHERE StageName != null
            GROUP BY StageName
            ORDER BY avgQuality DESC
        ];
    }

    /* ----------------------------------------------------------------------
     * topOpportunities(Decimal minScore)
     * ----------------------------------------------------------------------
     * RELATIONSHIP QUERY - parent lookup WITHOUT a second query.
     * `Account.Name`, `Account.Industry` are pulled from the parent Account.
     * Binds the parameter with a colon (safe from injection).
     * ----------------------------------------------------------------------
     */
    public static List<Opportunity> topOpportunities(Decimal minScore) {
        return [
            SELECT Id, Name, StageName, Amount, Deal_Quality_Score__c,
                   Account.Name, Account.Industry
            FROM Opportunity
            WHERE Deal_Quality_Score__c >= :minScore
            ORDER BY Deal_Quality_Score__c DESC, Amount DESC
            LIMIT 10
        ];
    }

    /* ----------------------------------------------------------------------
     * accountsWithOpenOpportunities(Set<Id> accountIds)
     * ----------------------------------------------------------------------
     * PARENT-CHILD SUBQUERY - for a set of accounts, fetch child
     * Opportunities inline. One query instead of SOQL-in-a-loop.
     * ----------------------------------------------------------------------
     */
    public static List<Account> accountsWithOpenOpportunities(Set<Id> accountIds) {
        return [
            SELECT Id, Name,
                   (SELECT Id, Name, StageName, Amount
                    FROM Opportunities
                    WHERE IsClosed = false)
            FROM Account
            WHERE Id IN :accountIds
        ];
    }

    /* ----------------------------------------------------------------------
     * searchAccounts(String term)
     * ----------------------------------------------------------------------
     * SOSL - searches Account and Contact at once. Returns
     * List<List<SObject>>; index 0 = Account hits, index 1 = Contact hits.
     * ----------------------------------------------------------------------
     */
    public static List<List<SObject>> searchAccounts(String term) {
        if (String.isBlank(term)) {
            return null;
        }
        // SAFE: the term is passed as a bound variable, never concatenated.
        return [
            FIND :term IN ALL FIELDS
            RETURNING Account(Id, Name), Contact(Id, FirstName, LastName)
        ];
    }

    /* ----------------------------------------------------------------------
     * runSafeDynamicQuery(String whereClause)
     * ----------------------------------------------------------------------
     * DYNAMIC SOQL - builds the query string, but binds via :targetedField.
     * This is the PATTERN TO REMEMBER: never string-concatenate user input.
     * ----------------------------------------------------------------------
     */
    public static List<Account> runSafeDynamicQuery(String condition) {
        // The user-controlled part is escaped BEFORE building the query.
        String safeCondition = String.escapeSingleQuotes(condition);
        String query =
            'SELECT Id, Name, Health_Score__c FROM Account WHERE ' +
            safeCondition +
            ' LIMIT 5';
        // Database.query parses a string at runtime (a form of dynamic SOQL).
        return Database.query(query);
    }
}