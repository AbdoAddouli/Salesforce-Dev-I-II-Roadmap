/*
 * ============================================================================
 * AsyncJobService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 5 - Async Apex]
 *
 * WHAT THIS CLASS DOES:
 * A service that demonstrates the FULL async toolkit - Queueable, Schedulable,
 * Batchable - and records progress into the custom Async_Job_Monitor__c object.
 *
 * WHY ASYNC AT ALL:
 * Every Apex transaction has ~10s of CPU. When a process legitimately needs
 * more - or must run without slowing the user down - we hand off to a
 * background job. Different async flavours exist for different shapes of work:
 *
 *   Queueable   -> rich state (sObjects as parameters), job chaining, has an
 *                  AsyncApexJob Id to monitor.
 *   Batchable   -> millions of records processed in chunks (start/execute/
 *                  finish), Database.Stateful keeps values between batches.
 *   Schedulable -> run on a cron schedule (System.schedule).
 *   Future      -> simple fire-and-forget; we avoid it in this lab because
 *                  Queueable is strictly more capable.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. Async_Job_Monitor__c records let batch/queueable write their progress,
 *    making background work OBSERVABLE (and report/dashboard-able).
 * 2. Database.Stateful keeps a running tally across batches.
 * 3. System.enqueueJob / System.schedule / Database.executeBatch APIs.
 * 4. Async apex respects LOWER limits than sync for DML/query rows in terms
 *    of *callouts*, but batch gets 9-11x SOQL budget in exchange for jest.
 * ============================================================================
 */
public with sharing class AsyncJobService implements Queueable, Schedulable {

    /* Monitor record we create/modify so the UI can chart the job. */

    /* ----------------------------------------------------------------------
     * initializeMonitors(List<Async_Job_Monitor__c> monitors)
     * ----------------------------------------------------------------------
     * BEFORE-INSERT helper for the AsyncJobMonitorTrigger: fill defaults
     * for fields the user should not type (Queued, Started timestamp).
     * In-memory DML: because the trigger is BEFORE INSERT, the edits are
     * saved with the insert automatically - no second DML call.
     * ----------------------------------------------------------------------
     */
    public static void initializeMonitors(List<Async_Job_Monitor__c> monitors) {
        Datetime now = System.now();
        for (Async_Job_Monitor__c m : monitors) {
            if (m.Job_Status__c == null) {
                m.Job_Status__c = 'Queued';
            }
            if (m.Started_At__c == null) {
                m.Started_At__c = now;
            }
        }
    }

    /* ----------------------------------------------------------------------
     * enqueueMonitor(Async_Job_Monitor__c monitor)
     * ----------------------------------------------------------------------
     * Insert a monitor row and enqueue a Queueable that updates it.
     * Inserting gives the queueable the Id to update when the job starts.
     * ----------------------------------------------------------------------
     */
    public static Id enqueueMonitor(Async_Job_Monitor__c monitor) {
        insert monitor;

        MonitorQueueable job = new MonitorQueueable(monitor.Id);
        return System.enqueueJob(job);
    }

    /* ----------------------------------------------------------------------
     * scheduleDailyHealthRefresh()
     * ----------------------------------------------------------------------
     * Schedulable entry point: runs every night at 02:00 GMT.
     * Cron = "second minute hour day-of-month month day-of-week".
     * ----------------------------------------------------------------------
     */
    public static Id scheduleDailyHealthRefresh() {
        String cron = '0 0 2 * * ?';
        return System.schedule(
            'Daily Account Health Refresh',
            cron,
            new AsyncJobService()
        );
    }

    /* ----------------------------------------------------------------------
     * runHealthScoreBatch()
     * ----------------------------------------------------------------------
     * Fire the Batchable from the Schedulable (or from anywhere).
     * ----------------------------------------------------------------------
     */
    public static Id runHealthScoreBatch() {
        HealthScoreRecalculator batch = new HealthScoreRecalculator();
        // 200 records per chunk is a deliberate, balanced default.
        return Database.executeBatch(batch, 200);
    }

    /* ======================================================================
     * Queueable implementation
     * ======================================================================
     * Queueable has ONE required method: execute(QueueableContext).
     *
     * QueueableContext gives us AsyncApexJob; we log the Id to monitor.
     * ======================================================================
     */
    public class MonitorQueueable implements Queueable {
        private final Id monitorId;

        public MonitorQueueable(Id monitorId) {
            this.monitorId = monitorId;
        }

        public void execute(QueueableContext context) {
            // mark Running + snapshot the AsyncApexJob Id for observability
            Async_Job_Monitor__c monitor = new Async_Job_Monitor__c(
                Id = monitorId,
                Job_Status__c = 'Running',
                Related_Object__c = 'Async_Job_Monitor__c'
            );
            try {
                // simulate meaningful work: bump every monitor's counters
                updateHealthScoresAsync();
                monitor.Job_Status__c = 'Completed';
                monitor.Finished_At__c = System.now();
            } catch (Exception e) {
                monitor.Job_Status__c = 'Failed';
                monitor.Error_Message__c = e.getMessage().left(1000);
            }
            upsert monitor;
        }
    }

    // Inner helper so the Queueable stays small: delegates real work.
    private static void updateHealthScoresAsync() {
        PerformanceService.rebuildHealthScores('SELECT Id FROM Account');
    }

    /* ======================================================================
     * Batchable + Schedulable glue
     * ======================================================================
     * A batch class is also Schedulable-compatible - it can implement both,
     * but we keep them separate for readability.
     * ======================================================================
     */
    public class HealthScoreRecalculator
        implements Database.Batchable<SObject>, Schedulable {

        public void execute(SchedulableContext sc) {
            // kick off from the scheduler
            Database.executeBatch(new HealthScoreRecalculator(), 200);
        }

        public Database.QueryLocator start(Database.BatchableContext bc) {
            // start() returns a QueryLocator; the platform streams rows lazily,
            // so huge objects never blow the heap in a single fetch.
            return Database.getQueryLocator(
                'SELECT Id, Health_Score__c FROM Account'
            );
        }

        public void execute(
            Database.BatchableContext bc,
            List<SObject> scope
        ) {
            // scope is ONE batch of up to 200 records.
            // Map pattern: collect the accounts, compute new scores in memory.
            List<Account> accounts = (List<Account>) scope;
            for (Account acc : accounts) {
                acc.Health_Score__c = clampScore(acc.Health_Score__c);
            }
            update accounts; // ONE bulk DML for the whole scope
        }

        public void finish(Database.BatchableContext bc) {
            // finish() runs once after all batches. Great place to notify.
            System.debug('Health score batch finished.');
        }
    }

    public static Integer clampScore(Integer raw) {
        if (raw == null) {
            return 70;
        }
        return Math.min(100, Math.max(0, raw));
    }
}