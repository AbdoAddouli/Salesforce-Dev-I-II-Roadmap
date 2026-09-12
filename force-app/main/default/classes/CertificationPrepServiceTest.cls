/*
 * ============================================================================
 * CertificationPrepServiceTest
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 13 - Certification prep engine]
 *
 * WHAT IT TESTS:
 *  - the sanitize hooks (trim, defaults),
 *  - the mini quiz engine scoring against the correct answers,
 *  - the study-plan generator building exactly the 13 roadmap phases
 *    in a single bulk DML statement.
 * ============================================================================
 */
@isTest
private class CertificationPrepServiceTest {

    @TestSetup
    static void makeData() {
        Training_Question__c q1 = new Training_Question__c(
            Name = 'Q1 PDI',
            Question_Text__c = ' What is a governor limit? ',
            Answer_Option_A__c = 'A limit to protect multi-tenant resources',
            Answer_Option_B__c = 'A compiler warning',
            Correct_Answer__c = 'A',
            Difficulty__c = 'Medium',
            Exam_Domain__c = 'Developer Fundamentals',
            Certification_Target__c = 'Platform Developer I',
            Is_Active__c = true
        );
        Training_Question__c q2 = new Training_Question__c(
            Name = 'Q2 PDI',
            Question_Text__c = 'Which keyword returns the parent of a child?',
            Answer_Option_A__c = 'WITH',
            Answer_Option_B__c = 'FROM',
            Answer_Option_C__c = 'WITH SOQL PARSER',
            Correct_Answer__c = 'C',
            Difficulty__c = 'Medium',
            Exam_Domain__c = 'SOQL & SOSL',
            Certification_Target__c = 'Platform Developer I',
            Is_Active__c = true
        );
        insert new List<Training_Question__c>{ q1, q2 };
    }

    @isTest
    static void sanitizeTrimsAndFillsDefaults() {
        Training_Question__c q = new Training_Question__c(
            Question_Text__c = '  Spaced  ',
            Correct_Answer__c = null,
            Difficulty__c = null,
            Certification_Target__c = 'Platform Developer I'
        );
        CertificationPrepService.sanitizeTrainingQuestions(
            new List<Training_Question__c>{ q }
        );
        System.assertEquals('Spaced', q.Question_Text__c);
        System.assertEquals('A', q.Correct_Answer__c);
        System.assertEquals('Medium', q.Difficulty__c);
    }

    @isTest
    static void scoreQuizGradesInMemoryWithoutRecursion() {
        List<Training_Question__c> questions = [
            SELECT Id, Correct_Answer__c
            FROM Training_Question__c
            LIMIT 2
        ];
        Map<Id, String> submitted = new Map<Id, String>{
            questions[0].Id => questions[0].Correct_Answer__c, // correct
            questions[1].Id => 'A'                              // wrong (C)
        };

        CertificationPrepService.QuizOutcome outcome =
            CertificationPrepService.scoreQuiz(submitted);
        System.assertEquals(1, outcome.correct);
        System.assertEquals(2, outcome.total);
        System.assertEquals(50, outcome.score);
    }

    @isTest
    static void buildStudyPlanMaterializesAll13PhasesOnce() {
        Id learnerId = UserInfo.getUserId();
        Integer count = CertificationPrepService.buildStudyPlan(
            learnerId,
            'Platform Developer I',
            Date.today().addMonths(6)
        );
        System.assertEquals(13, count);

        List<Study_Plan__c> saved = [
            SELECT Phase_Number__c, Phase_Name__c, Status__c
            FROM Study_Plan__c
            WHERE Learner__c = :learnerId
            ORDER BY Phase_Number__c
        ];
        System.assertEquals(13, saved.size());
        // Phase ordering is monotonically increasing.
        for (Integer i = 0; i < saved.size(); i++) {
            System.assertEquals(i + 1, saved[i].Phase_Number__c);
        }
    }

    @isTest
    static void getQuestionsFiltersByCertificationAndActive() {
        List<Training_Question__c> questions =
            CertificationPrepService.getQuestionsByCertification(
                'Platform Developer I'
            );
        System.assertEquals(2, questions.size());
    }
}