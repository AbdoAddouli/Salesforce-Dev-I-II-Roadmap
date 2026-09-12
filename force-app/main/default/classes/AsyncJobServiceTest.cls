/*
 * ============================================================================
 * AsyncJobServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 5 - Async Apex + Test.startTest/stopTest]
 *
 * WHAT IT TESTS:
 *  - Async_Job_Monitor__c defaults via the BEFORE-INSERT trigger path,
 *  - Queueable execution (enqueued in startTest, runs at stopTest),
 *  - scheduling a Schedulable (valid cron in startTest),
 *  - running a Batchable to completion inside startTest/stopTest.
 *
 * WHY startTest/stopTest:
 * Async work is deferred by the platform. Test.startTest() tells Salesforce
 * "the real code-under-test starts"; Test.stopTest() forces all pending
 * async jobs (queueable, scheduled, batch) to complete BEFORE the method
 * returns. Without it you cannot assert what the job did.
 * ============================================================================
 */
@isTest
private class AsyncJobServiceTest {

    @TestSetup
    static void makeData() {
        // null Health_Score__c: the clamp DEFAULT is 70, and the batch/scheduler
        // paths write the default so we can assert the value change.
        Account target = new Account(
            Name = 'Async Target Co',
            Health_Score__c = null
        );
        insert target;
    }

    @isTest
    static void triggerDefaultsFillQueuedStatusAndStartedAt() {
        Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
            Job_Type__c = 'Queueable',
            Related_Object__c = 'Account'
        );
        insert monitor; // AsyncJobMonitorTrigger (before insert) runs here

        Async_Job_Monitor__c saved = [
            SELECT Job_Status__c, Started_At__c
            FROM Async_Job_Monitor__c
            WHERE Id = :monitor.Id
        ];
        System.assertEquals('Queued', saved.Job_Status__c);
        System.assertNotEquals(null, saved.Started_At__c);
    }

    @isTest
    static void queueableCompletesInsideStartTestStopTest() {
        Test.startTest();
        Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
            Job_Type__c = 'Queueable',
            Related_Object__c = 'Account'
        );
        Id jobId = AsyncJobService.enqueueMonitor(monitor);
        System.assertNotEquals(null, jobId);
        Test.stopTest(); // forces the queued work to finish

        Async_Job_Monitor__c completed = [
            SELECT Job_Status__c, Finished_At__c
            FROM Async_Job_Monitor__c
            LIMIT 1
        ];
        System.assertEquals(
            'Completed',
            completed.Job_Status__c,
            'The queueable runs to completion when Test.stopTest() fires'
        );
    }

    @isTest
    static void schedulerRegistersACronJob() {
        Test.startTest();
        Id cronId = AsyncJobService.scheduleDailyHealthRefresh();
        Test.stopTest();
        System.assertNotEquals(null, cronId);
    }

    @isTest
    static void batchRecalculatesScoresAcrossChunks() {
        Test.startTest();
        Id batchId = AsyncJobService.runHealthScoreBatch();
        Test.stopTest();

        System.assertNotEquals(null, batchId);
        Account a = [
            SELECT Health_Score__c
            FROM Account
            WHERE Name = 'Async Target Co'
        ];
        // null scores default to 70, written by the batch's clamp.
        System.assertEquals(70, a.Health_Score__c);
    }
}