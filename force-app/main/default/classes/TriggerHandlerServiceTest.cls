/*
 * ============================================================================
 * TriggerHandlerServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 4 - Trigger framework + recursion prevention]
 *
 * WHAT IT TESTS:
 * The bypass registry (suppress/restore/shouldRun) and the recursion guard
 * (markProcessed/hasProcessed). These two mechanisms are the heart of every
 * trigger framework; a regression here would let recursion blow up
 * production automation - hence first-class tests.
 * ============================================================================
 */
@isTest
private class TriggerHandlerServiceTest {

    @isTest
    static void handlerRunsByDefaultThenRespectsSuppression() {
        System.assert(
            TriggerHandlerService.shouldRun('AccountTrigger'),
            'Suppression registry is empty => handler should run'
        );

        TriggerHandlerService.suppress('AccountTrigger');
        System.assertNotEquals(
            true,
            TriggerHandlerService.shouldRun('AccountTrigger')
        );

        TriggerHandlerService.restore('AccountTrigger');
        System.assert(
            TriggerHandlerService.shouldRun('AccountTrigger'),
            'Restore removes the suppression'
        );
    }

    @isTest
    static void recursionGuardIsTranslationLocal() {
        Account acct = new Account(Name = 'Guard Probe');
        insert acct; // a REAL Id - the guard only accepts real record keys

        System.assert(!TriggerHandlerService.hasProcessed(acct.Id));

        TriggerHandlerService.markProcessed(acct.Id);
        System.assert(
            TriggerHandlerService.hasProcessed(acct.Id),
            'markProcessed makes the Id visible to the same transaction'
        );
    }

    @isTest
    static void guardSetIsMonoDirPerTestMethod() {
        // The Set is STATIC, but Apex resets static state between test
        // methods - so this must start empty again.
        System.assert(
            TriggerHandlerService.processedExternalIds.isEmpty(),
            'Fresh static state each isTest method'
        );
    }
}