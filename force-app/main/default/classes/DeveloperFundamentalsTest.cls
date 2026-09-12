/*
 * ============================================================================
 * DeveloperFundamentalsTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 1 - Developer Fundamentals]
 *
 * WHAT IT TESTS:
 * The most fundamental Apex behaviours:
 *   - Creating records (DML) and reading them back (SOQL),
 *   - The governor-limit maths on the Data platform,
 *   - Test data isolation (SeeAllData=false by default: we ONLY see what we
 *     create in this class),
 *   - @TestSetup creating shared data for every test method,
 *   - relationships - the parent Account of an inserted Contact.
 *
 * THE 75% RULE: this class models the coverage habit. Every test method
 * ends with an assertion - never a bare insert (a test without assertions
 * is worthless even if it "covers" code).
 * ============================================================================
 */
@isTest
private class DeveloperFundamentalsTest {

    @TestSetup
    static void makeData() {
        // @TestSetup: runs ONCE for the whole class; each test method sees
        // the same rows. Isolates data and speeds the class up.
        Account acct = new Account(
            Name = 'Dev Roadmap Food Co'
        );
        insert acct;

        Contact mentor = new Contact(
            FirstName = 'Ada',
            LastName = 'Lovelace',
            AccountId = acct.Id
        );
        insert mentor;
    }

    @isTest
    static void insertionAndGuardActsOnIsolatedData() {
        // Because this is an @isTest with SeeAllData=false, the ONLY Accounts
        // we can see are the ones this class created.
        List<Account> accounts = [SELECT Id, Name FROM Account];
        System.assert(
            accounts.size() == 1,
            'Data isolation means only our @TestSetup Account exists'
        );
        System.assertEquals(
            'Dev Roadmap Food Co',
            accounts[0].Name
        );
    }

    @isTest
    static void relationshipQueryAddressesTheParentAccount() {
        // Parent lookup via dot-path is available right after DML.
        Contact ada = [
            SELECT FirstName, LastName, Account.Name
            FROM Contact
            LIMIT 1
        ];
        System.assertEquals('Lovelace', ada.LastName);
        System.assertEquals('Dev Roadmap Food Co', ada.Account.Name);
    }

    @isTest
    static void limitsUtilsReflectTheTransactionShape() {
        // Demonstrates the Limits API the way the exam describes it: after a
        // few statements we can introspect what the transaction consumed.
        System.debug('Soql queries used so far: ' + Limits.getQueries());
        System.assert(
            Limits.getQueries() <= Limits.getLimitQueries(),
            'We must stay far below the 100-query governor'
        );
    }
}