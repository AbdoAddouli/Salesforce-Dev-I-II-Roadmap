/*
 * ============================================================================
 * CertificationPrepService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 13 - Certification Prep]
 *
 * WHAT THIS CLASS DOES:
 * Powers the certification engine: a mini question bank stored in
 * Training_Question__c and a study-plan generator materialised as
 * Study_Plan__c rows. It is used by two thin triggers:
 *   - TrainingQuestionTrigger  (before insert/update -> sanitize)
 *   - StudyPlanTrigger         (before insert        -> initialize)
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. BULK DML LIST - buildStudyPlan inserts 13 rows in ONE insert(list).
 *    This is the "no DML in a loop" rule shown end-to-end.
 *
 * 2. STRING PARSING FOR A QUIZ - scoreQuiz normalises the submitted answer,
 *    looks up correct answers in ONE SOQL, and compares in-memory.
 *
 * 3. TRAIN (sanitize) hooks - before-insert "soft rules" that make the UI
 *    resilient: trim whitespace, default missing values, cap empty options.
 *
 * 4. `with sharing` - running user's sharing respected on reads and updates.
 * ============================================================================
 */
public with sharing class CertificationPrepService {

    public static final List<String> PHASE_NAMES = new List<String>{
        'Developer Fundamentals',
        'Apex Language Essentials',
        'SOQL & SOSL',
        'Triggers & Order of Execution',
        'Async Apex & Platform Events',
        'Automation: Flows + Apex',
        'UI Foundations: Visualforce & Aura',
        'Lightning Web Components',
        'Testing & Debugging',
        'Performance & Large Data Volumes',
        'Integration & Enterprise Patterns',
        'Release Management & CI/CD',
        'Certification Prep'
    };

    /* ----------------------------------------------------------------------
     * sanitizeTrainingQuestions(List<Training_Question__c> questions)
     * ----------------------------------------------------------------------
     * BEFORE INSERT/UPDATE hook (TrainingQuestionTrigger). Edits happen on
     * the in-memory records; DML commit is handled by the trigger life-cycle.
     * ----------------------------------------------------------------------
     */
    public static void sanitizeTrainingQuestions(
        List<Training_Question__c> questions
    ) {
        for (Training_Question__c q : questions) {
            if (String.isNotBlank(q.Question_Text__c)) {
                q.Question_Text__c = q.Question_Text__c.trim();
            }
            if (String.isNull(q.Correct_Answer__c)) {
                q.Correct_Answer__c = 'A';
            }
            if (q.Difficulty__c == null) {
                q.Difficulty__c = 'Medium';
            }
        }
    }

    /* ----------------------------------------------------------------------
     * initializeStudyPlans(List<Study_Plan__c> plans)
     * ----------------------------------------------------------------------
     * BEFORE INSERT hook (StudyPlanTrigger): every new plan starts at
     * Phase 1, "Not Started" and records today's date if none was set.
     * ----------------------------------------------------------------------
     */
    public static void initializeStudyPlans(List<Study_Plan__c> plans) {
        Date today = System.today();
        for (Study_Plan__c plan : plans) {
            if (plan.Phase_Number__c == null) {
                plan.Phase_Number__c = 1;
            }
            if (plan.Status__c == null) {
                plan.Status__c = 'Not Started';
            }
            if (plan.Start_Date__c == null) {
                plan.Start_Date__c = today;
            }
        }
    }

    /* ----------------------------------------------------------------------
     * getQuestionsByCertification(String certificationTarget)
     * ----------------------------------------------------------------------
     * SELECT the field via SOQL once; keep the in-memory list typed and
     * sorted. Good example of a "selector" slice.
     * ----------------------------------------------------------------------
     */
    public static List<Training_Question__c> getQuestionsByCertification(
        String certificationTarget
    ) {
        return [
            SELECT Id, Question_Text__c, Answer_Option_A__c, Answer_Option_B__c,
                   Answer_Option_C__c, Answer_Option_D__c, Answer_Option_E__c,
                   Correct_Answer__c, Explanation__c, Exam_Domain__c,
                   Certification_Target__c, Difficulty__c
            FROM Training_Question__c
            WHERE Is_Active__c = true
              AND Certification_Target__c = :certificationTarget
            ORDER BY Exam_Domain__c, Name
        ];
    }

    /* ----------------------------------------------------------------------
     * scoreQuiz(Map<Id, String> submitted)
     * ----------------------------------------------------------------------
     * MINI QUIZ ENGINE: submitted = questionId -> chosen letter.
     * Fetches right answers in ONE SOQL (bulk!), compares, and returns
     * a score summary record.
     * ----------------------------------------------------------------------
     */
    public static QuizOutcome scoreQuiz(Map<Id, String> submitted) {
        QuizOutcome outcome = new QuizOutcome();
        if (submitted == null || submitted.isEmpty()) {
            outcome.score = 0;
            outcome.total = 0;
            return outcome;
        }

        Map<Id, Training_Question__c> questionsById = new Map<Id, Training_Question__c>([
            SELECT Id, Correct_Answer__c
            FROM Training_Question__c
            WHERE Id IN :submitted.keySet()
        ]);

        Integer correct = 0;
        for (Id questionId : submitted.keySet()) {
            Training_Question__c q = questionsById.get(questionId);
            if (q == null) {
                continue;
            }
            String answer = String.valueOf(submitted.get(questionId)).trim();
            if (answer.equalsIgnoreCase(q.Correct_Answer__c)) {
                correct++;
            }
        }
        outcome.correct = correct;
        setOutcomeTotals(outcome, questionsById.size());
        return outcome;
    }

    // helper keeps scoreQuiz readable; percent maths stays Integer-safe
    private static void setOutcomeTotals(QuizOutcome o, Integer total) {
        o.total = total;
        o.score = total == 0 ? 0 : Integer.valueOf(Math.round((o.correct * 100.0) / total));
    }

    /* ----------------------------------------------------------------------
     * buildStudyPlan(Id learnerId, String cert, Date targetDate)
     * ----------------------------------------------------------------------
     * Creates 13 Study_Plan__c rows - ONE per phase - in a single insert().
     * The takeaway: gather ALL records first, then one bulk DML.
     * ----------------------------------------------------------------------
     */
    public static Integer buildStudyPlan(
        Id learnerId,
        String cert,
        Date targetDate
    ) {
        List<Study_Plan__c> plans = new List<Study_Plan__c>();
        Integer phase = 1;
        for (String phaseName : PHASE_NAMES) {
            plans.add(
                new Study_Plan__c(
                    Learner__c = learnerId,
                    Certification_Target__c = cert,
                    Phase_Number__c = phase,
                    Phase_Name__c = phaseName,
                    Status__c = phase == 1 ? 'In Progress' : 'Not Started',
                    Start_Date__c = System.today(),
                    Target_Exam_Date__c = targetDate,
                    Weekly_Goal_Hours__c = 8,
                    Completed_Lessons__c = 0
                )
            );
            phase++;
        }
        insert plans; // single DML statement for all 13 rows
        return plans.size();
    }

    /* ----------------------------------------------------------------------
     * QuizOutcome
     * ----------------------------------------------------------------------
     * A lightweight "record" transferring the scoring summary to the caller
     * without a second round-trip.
     * ----------------------------------------------------------------------
     */
    public class QuizOutcome {
        public Integer correct;
        public Integer total;
        public Integer score;
    }
}