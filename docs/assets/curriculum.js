/* ============================================================================
 * Developer I & II Academy - Curriculum data
 * 15 phases following the `developer Roadmap/` guides. Content is condensed
 * from the phase guides and points back to the real repo artifacts.
 * ============================================================================
 */

const GUIDE = 'https://github.com/AbdoAddouli/Salesforce-Dev-I-II-Roadmap/blob/main/developer%20Roadmap/';

const ACADEMY = [

/* -------------------------------------------------------------------------- */
/* PHASE 1 - DEVELOPER FUNDAMENTALS                                            */
/* -------------------------------------------------------------------------- */
{
  id: 'fund',
  n: 1,
  title: 'Developer Fundamentals',
  icon: '01',
  color: '#4F46E5',
  tagline: 'Org model, data model, SOQL & DML basics',
  guide: '01-Developer-Fundamentals.md',
  art: [
    { label: 'DeveloperFundamentalsTest', href: 'force-app/main/default/classes/DeveloperFundamentalsTest.cls' },
    { label: 'config/project-scratch-def.json', href: 'config/project-scratch-def.json' },
    { label: 'Custom objects (objects/)', href: 'force-app/main/default/objects/' },
  ],
  objectives: [
    'Explain the org, object, record and field model',
    'Describe standard vs custom objects and relationships',
    'Write basic SOQL with fields and parent lookups',
    'Use DML insert / update / upsert / delete correctly',
    'Understand system context vs user context and sharing keywords',
  ],
  lessons: [
    {
      title: 'The Platform Data Model', mins: 8,
      blocks: [
        { t: 'p', x: 'Every Salesforce org is a set of OBJECTS (database tables), FIELDS (columns) and RECORDS (rows). Standard objects ship with the platform; custom objects plugin with the __c suffix.' },
        { t: 'table', head: ['Concept', 'SQL analogy', 'Example'], rows: [
          ['Object', 'Table', 'Account, Opportunity, Contact'],
          ['Field', 'Column', 'Health_Score__c, StageName'],
          ['Record', 'Row', 'An Account named Acme Corp'],
          ['Relationship', 'Foreign Key / Join', 'Contact.AccountId -> Account'],
        ]},
        { t: 'p', x: 'Two relationship flavours: Lookup (loose, both sides optional) and Master-Detail (tight: cascade delete, roll-up summaries, shared ownership). A custom object can have at most two Master-Detail relationships.' },
        { t: 'selfcheck', q: 'Roll-up summary fields require which relationship type?', a: 'Master-Detail. The summary lives on the master and aggregates child records.' },
      ]
    },
    {
      title: 'System Context vs User Context', mins: 8,
      blocks: [
        { t: 'p', x: 'Apex can run in SYSTEM context (class declared without sharing keyword, or invoked by an integration) where it ignores the running user\'s sharing. User context (with sharing) respects record-level access.' },
        { t: 'code', lang: 'apex', x: `// with sharing: + record access of the calling user
public with sharing class MyService {
    public static List<Account> mine() {
        return [SELECT Id FROM Account];
    }
}` },
        { t: 'callout', kind: 'tip', x: 'Modern best practice: use the keyword explicitly (with / without / inherited sharing). Never leave it implicit; the PDII exam tests the side effects.' },
        { t: 'selfcheck', q: 'A with-sharing class queries Accounts. What does the running user observe?', a: 'Only records the user has sharing access to (Private OWD hides the rest).' },
      ]
    },
    {
      title: 'First SOQL & DML', mins: 10,
      blocks: [
        { t: 'code', lang: 'apex', x: `Account a = new Account(Name = 'Acme', Health_Score__c = 88);
insert a;                                         // DML create

a.Health_Score__c = 90;
update a;                                         // DML update

Account saved = [SELECT Id, Name, Health_Score__c
                 FROM Account WHERE Id = :a.Id];  // SOQL query` },
        { t: 'list', items: [
          'DML calls: insert, update, upsert, delete, undelete, merge',
          'SOQL returns typed SObject lists; bind variables with a colon',
          'Database.* methods (e.g. Database.insert) return SaveResults you can inspect',
        ]},
        { t: 'callout', kind: 'warn', x: 'Never loop DML. Build a List<Account> and call insert(list) once - the single most repeated exam-style bug.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 1 Quiz - Developer Fundamentals', mins: 5,
    questions: [
      { q: 'Roll-up summaries require which relationship?',
        opts: ['Lookup', 'Master-Detail', 'Polymorphic', 'Hierarchical'], a: 1, why: 'Roll-up summaries aggregate children onto the master of a Master-Detail relationship.' },
      { q: 'A with sharing class sees records based on.',
        opts: ['System access', 'The running user\'s sharing access', 'The owner only', 'No filtering'], a: 1, why: 'with sharing enforces record-level access of the calling user.' },
      { q: 'Which DML is best to insert-or-update in one statement?',
        opts: ['update', 'upsert', 'merge', 'insert'], a: 1, why: 'upsert either inserts new or updates existing records (optionally keyed by an external id).' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 2 - APEX LANGUAGE ESSENTIALS                                          */
/* -------------------------------------------------------------------------- */
{
  id: 'apex',
  n: 2,
  title: 'Apex Language Essentials',
  icon: '02',
  color: '#7C3AED',
  tagline: 'Primitives, collections, classes, exceptions',
  guide: '02-Apex-Language-Essentials.md',
  art: [
    { label: 'SecurityService (inner class + exception)', href: 'force-app/main/default/classes/SecurityService.cls' },
    { label: 'IntegrationService.CalloutResult', href: 'force-app/main/default/classes/IntegrationService.cls' },
    { label: 'CertificationPrepService.QuizOutcome', href: 'force-app/main/default/classes/CertificationPrepService.cls' },
  ],
  objectives: [
    'Use primitives, Blob, sObject and collections',
    'Choose List / Set / Map for the right job',
    'Write methods, constructors, inner classes and enums',
    'Model errors with custom exception classes',
    'Explain access modifiers including global',
  ],
  lessons: [
    {
      title: 'Data Types & Collections', mins: 9,
      blocks: [
        { t: 'code', lang: 'apex', x: `Integer n = 42;            // primitives
Decimal d = 42.5;           // currency-safe decimal
Boolean ok = true;          // not "true"? then NOT
String s = 'hello';
List<String> tags = new List<String>{ 'a', 'b' };
Set<Id> seen = new Set<Id>();
Map<Id, Account> byId = new Map<Id, Account>();` },
        { t: 'p', x: 'Lists keep order, Sets de-duplicate, Maps give O(1) lookup. The classic performance win: build a Map once and join - never nested-for nested lookups.' },
        { t: 'selfcheck', q: 'You must de-duplicate account ids from a feed. Which collection?', a: 'Set<Id> - uniqueness is its whole purpose.' },
      ]
    },
    {
      title: 'Classes, Inner Classes & Enums', mins: 9,
      blocks: [
        { t: 'code', lang: 'apex', x: `public enum SecurityAccess { READ, CREATE, UPDATE, DELETE }

public class SecurityService {
    public class SecurityAccessDeniedException extends Exception {
    }
}` },
        { t: 'p', x: 'Inner classes group small contracts (exceptions, DTOs like QuizOutcome, CalloutResult) next to the class that uses them. Enums give a fixed, readable choice set.' },
        { t: 'callout', kind: 'tip', x: 'A custom exception extends Exception. Throwing it gives callers a catchable, self-describing error instead of a generic one.' },
      ]
    },
    {
      title: 'Access Modifiers', mins: 8,
      blocks: [
        { t: 'table', head: ['Modifier', 'Visibility'], rows: [
          ['private', 'Inside the class only (default)'],
          ['protected', 'Class + subclasses'],
          ['public', 'Any Apex in the org'],
          ['global', 'Cross-namespace + REST callouts from outside'],
        ]},
        { t: 'p', x: '@RestResource methods must be global static. @AuraEnabled methods must be public (or global). Everything else defaults to private - good encapsulation hygiene.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 2 Quiz - Apex Language Essentials', mins: 5,
    questions: [
      { q: 'Which collection guarantees uniqueness?',
        opts: ['List', 'Map (keys)', 'Set', 'Array'], a: 2, why: 'Set<T> stores unique elements only.' },
      { q: 'A REST resource method must be declared.',
        opts: ['private static', 'public static', 'global static', 'protected'], a: 2, why: 'REST resources are invoked from outside the org, so they must be global.' },
      { q: 'A custom exception is created by.',
        opts: ['extends Exception', 'implements Thrower', 'new CustomException', 'enum Exception'], a: 0, why: 'Custom exceptions subclass System.Exception.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 3 - SOQL & SOSL                                                       */
/* -------------------------------------------------------------------------- */
{
  id: 'soql',
  n: 3,
  title: 'SOQL & SOSL',
  icon: '03',
  color: '#0EA5E9',
  tagline: 'Queries, joins, aggregates and search',
  guide: '03-SOQL-and-SOSL.md',
  art: [
    { label: 'SoqlSoslService', href: 'force-app/main/default/classes/SoqlSoslService.cls' },
    { label: 'SoqlSoslServiceTest', href: 'force-app/main/default/classes/SoqlSoslServiceTest.cls' },
    { label: 'Scripts (scripts/soql/)', href: 'scripts/soql/' },
  ],
  objectives: [
    'Write SELECT filters, ordering, limits and offsets',
    'Aggregate with COUNT/SUM/AVG, GROUP BY and HAVING',
    'Query relationships with dot notation and subqueries',
    'Use SOSL FIND across multiple objects',
    'Guard dynamic SOQL from injection',
  ],
  lessons: [
    {
      title: 'SELECT Fundamentals', mins: 9,
      blocks: [
        { t: 'code', lang: 'apex', x: `SELECT Id, Name, Health_Score__c
FROM Account
WHERE Health_Score__c >= 80
  AND Industry = 'Technology'
ORDER BY Name
LIMIT 10` },
        { t: 'list', items: [
          'Filters: =, >, <, >=, <=, !=, IN, LIKE with % wildcards',
          'ORDER BY field (ASC/DESC), NULLS FIRST/LAST',
          'LIMIT / OFFSET for paging',
          'Bind values with :myVar - never string-concatenate',
        ]},
      ]
    },
    {
      title: 'Aggregates & Grouping', mins: 10,
      blocks: [
        { t: 'code', lang: 'apex', x: `List<AggregateResult> rows = [
    SELECT StageName, AVG(Deal_Quality_Score__c) avgQuality
    FROM Opportunity
    GROUP BY StageName
];
for (AggregateResult r : rows) {
    Decimal avg = (Decimal) r.get('avgQuality'); // read by ALIAS
}` },
        { t: 'p', x: 'AggregateResult has no typed fields - every value is fetched by the query alias via get(\'alias\'). Use HAVING to filter grouped results.' },
        { t: 'selfcheck', q: 'You need the average quality score per stage. Which query feature?', a: 'GROUP BY with AVG(field) - results read through the alias with r.get(\'alias\').' },
      ]
    },
    {
      title: 'Relationships & Search', mins: 11,
      blocks: [
        { t: 'code', lang: 'apex', x: `// parent: dot notation
SELECT Id, Name, Account.Name FROM Opportunity WHERE Id = :oppId;

// child: subquery
SELECT Id, Name,
       (SELECT Id, Amount FROM Opportunities WHERE IsClosed = false)
FROM Account WHERE Id IN :accountIds;

// SOSL: one search, many objects
List<List<SObject>> hits = [
    FIND :term IN ALL FIELDS
    RETURNING Account(Id, Name), Contact(Id, Name)
];
// hits[0] = Account matches, hits[1] = Contact matches` },
        { t: 'callout', kind: 'warn', x: 'SOSL is for full-text search ACROSS objects or fields. SOQL is for structured querying. Use SOSL when the user types a free-text term.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 3 Quiz - SOQL & SOSL', mins: 5,
    questions: [
      { q: 'A student types "Acme" into a search box. Best tool?',
        opts: ['SOQL', 'SOSL', 'Aggregate query', 'Relationship query'], a: 1, why: 'Free-text search across objects is SOSL FIND.' },
      { q: 'AggregateResult values are read via.',
        opts: ['Object fields', 'result.get(\'alias\')', 'get(field, value)', 'SQL columns'], a: 1, why: 'Aggregate output is accessed by the query alias.' },
      { q: 'Which filter keeps this portable: WHERE Name LIKE :term?',
        opts: ['String concatenation', 'A bind variable', 'A static term', 'A formula'], a: 1, why: 'Bind variables keep queries safe and maintainable.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 4 - TRIGGERS & ORDER OF EXECUTION                                     */
/* -------------------------------------------------------------------------- */
{
  id: 'trig',
  n: 4,
  title: 'Triggers & Order of Execution',
  icon: '04',
  color: '#F59E0B',
  tagline: 'Context variables, bulk patterns, handler framework',
  guide: '04-Triggers-and-Order-of-Execution.md',
  art: [
    { label: 'TriggerHandlerService', href: 'force-app/main/default/classes/TriggerHandlerService.cls' },
    { label: 'AccountTrigger', href: 'force-app/main/default/triggers/AccountTrigger.trigger' },
    { label: 'CodeReviewTrigger', href: 'force-app/main/default/triggers/CodeReviewTrigger.trigger' },
  ],
  objectives: [
    'Use Trigger.new / old / oldMap and the is* context flags',
    'Write bulk-safe triggers (no SOQL/DML in loops)',
    'Implement the trigger-handler and recursion-guard patterns',
    'Recite the Salesforce Order of Execution',
    'Know what validation/formulas/FLS each phase runs',
  ],
  lessons: [
    {
      title: 'Context Variables', mins: 9,
      blocks: [
        { t: 'code', lang: 'apex', x: `trigger AccountTrigger on Account (before update) {
    System.debug(Trigger.new);       // incoming records
    System.debug(Trigger.oldMap);    // pre-update snapshot
    // isBefore/isAfter/isInsert/isUpdate/isDelete/isUndelete/isExecuting
}` },
        { t: 'p', x: 'Trigger.new is a list of the new values (fired records), oldMap the pre-change state for updates. One trigger serves ALL trigger events - switch on the is* flags.' },
        { t: 'callout', kind: 'tip', x: 'Detect a stage/status TRANSITION by comparing Trigger.new stage to Trigger.oldMap.get(record.Id).stage - never react to unchanged records.' },
      ]
    },
    {
      title: 'Bulk & Handler Patterns', mins: 11,
      blocks: [
        { t: 'code', lang: 'apex', x: `trigger AccountTrigger on Account (before update) {
    if (TriggerHandlerService.shouldRun('AccountTrigger')) {
        PerformanceService.normalizeHealthScores(Trigger.new);
    }
}` },
        { t: 'list', items: [
          'One handler class per trigger; the trigger stays a thin if-statement',
          'Collect the work, batch SOQL once, DML once (no loops)',
          'Guard recursion with a suppression registry + processed-id Set',
          'BEFORE triggers edit Trigger.new in-memory - zero extra DML',
        ]},
      ]
    },
    {
      title: 'Order of Execution', mins: 12,
      blocks: [
        { t: 'code', lang: 'text', x: `1. Load the record + fields from DB        5. AFTER triggers (incl. external changes)
2. Before-save validation rules           6. Assignment rules
3. BEFORE triggers                        7. Auto-response rules
4. System User-defined field updates      8. Workflow field updates    (legacy)
   from BEFORE triggers                   9. Process Builder (legacy)
                                          10. Escalation rules
                                          11. Record-triggered FLOWS
                                          12. Roll-up summary recalcs / formula eval
                                          13. AFTER-save commit + email/async` },
        { t: 'callout', kind: 'warn', x: 'Apex DEBUG confirms order: BEFORE triggers -> validation -> AFTER triggers -> assignment -> flows. Exam favourite: what runs when (and can you see attempts of SOQL/DML in loops there).' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 4 Quiz - Triggers & Order of Execution', mins: 5,
    questions: [
      { q: 'Which runs first when a record is saved?',
        opts: ['After trigger', 'Validation rules', 'Before triggers', 'Flows'], a: 2, why: 'Before triggers run before validation rules and after triggers.' },
      { q: 'To edit health scores before save with no extra DML, use.',
        opts: ['Before update trigger', 'After update trigger', 'Scheduled flow', 'Approval step'], a: 0, why: 'Before triggers edit Trigger.new in memory; the platform saves them.' },
      { q: 'A 200-record update fires the trigger how many times per record?',
        opts: ['200 times', 'Once - Trigger.new holds all 200', 'Per batch of 10', 'Twice total'], a: 1, why: 'Triggers are bulk: one execution with all records in Trigger.new.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 5 - ASYNC APEX & PLATFORM EVENTS                                      */
/* -------------------------------------------------------------------------- */
{
  id: 'async',
  n: 5,
  title: 'Async Apex & Platform Events',
  icon: '05',
  color: '#10B981',
  tagline: 'Queueable, Batch, Schedulable, EventBus',
  guide: '05-Async-Apex-and-Platform-Events.md',
  art: [
    { label: 'AsyncJobService', href: 'force-app/main/default/classes/AsyncJobService.cls' },
    { label: 'EventPublisherService', href: 'force-app/main/default/classes/EventPublisherService.cls' },
    { label: 'IntegrationEventSubscriberTrigger', href: 'force-app/main/default/triggers/IntegrationEventSubscriberTrigger.trigger' },
  ],
  objectives: [
    'Choose Queueable vs Batch vs Schedulable vs future',
    'Write batchable classes with Database.Stateful',
    'Schedule jobs with valid cron expressions',
    'Publish and subscribe to platform events',
    'Test async code with Test.startTest / stopTest',
  ],
  lessons: [
    {
      title: 'The Async Toolbox', mins: 11,
      blocks: [
        { t: 'table', head: ['Tool', 'Use when', 'Entry point'], rows: [
          ['Queueable', 'Stateful job + sObject args + chaining', 'System.enqueueJob'],
          ['Batchable', 'Millions of rows in chunks', 'Database.executeBatch'],
          ['Schedulable', 'Run on a cron', 'System.schedule'],
          ['@future', 'Simple fire-and-forget (no sObject args)', 'Call annotated method'],
        ]},
        { t: 'p', x: 'Async work inherits the CORRECTED record data and gets its own set of governor limits. Completed jobs are visible on Apex Jobs.' },
      ]
    },
    {
      title: 'Batch Mechanics', mins: 12,
      blocks: [
        { t: 'code', lang: 'apex', x: `public class HealthScoreRecalculator
    implements Database.Batchable<SObject>, Schedulable {

    public Database.QueryLocator start(bc) {
        return Database.getQueryLocator('SELECT Id, Health_Score__c FROM Account');
    }
    public void execute(bc, List<SObject> scope) {
        // scope = up to 200 records; DML once per chunk
        List<Account> as = (List<Account>) scope;
        for (Account a : as) a.Health_Score__c = clamp(a.Health_Score__c);
        update as;
    }
    public void finish(bc) { /* notify / re-enqueue */ }
}` },
        { t: 'p', x: 'start() returns a QueryLocator that streams lazily - no 50k-row heap limit. Chunk size is passed to Database.executeBatch(batch, 200).' },
      ]
    },
    {
      title: 'Platform Events', mins: 12,
      blocks: [
        { t: 'code', lang: 'apex', x: `// publish (bulk!)
List<Integration_Event__e> events = new List<Integration_Event__e>();
events.add(new Integration_Event__e(
    Direction__c = 'Outbound',
    Integration_Type__c = 'REST',
    Status__c = 'Success',
    Correlation_Id__c = correlationId
));
Integer accepted = EventBus.publish(events).size();` },
        { t: 'p', x: 'A subscriber trigger on the event object reacts after delivery. Low-volume events deliver synchronously after the transaction; high-volume are async and large. Events decouple publisher from subscriber (loose coupling).' },
        { t: 'selfcheck', q: 'Why use a platform event instead of a direct method call?', a: 'Loose coupling: publisher and subscriber never reference each other, and the bus survives either side changing.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 5 Quiz - Async Apex & Platform Events', mins: 5,
    questions: [
      { q: 'Process millions of records in 200-row chunks. Which class?',
        opts: ['Schedulable', 'Queueable', 'Batchable', '@future'], a: 2, why: 'Batchable iterates scope chunks via start/execute/finish.' },
      { q: 'A Queueable may receive which parameters?',
        opts: ['Standard primitives only', 'sObjects and their ids', 'No params', 'Only Dates'], a: 1, why: 'Queueables accept transactional (sObject) arguments - hence they are the preferred async tool.' },
      { q: 'Test async jobs by wrapping the enqueue in.',
        opts: ['Test.visibleForTesting', 'Test.startTest()...stopTest()', 'System.runAs', 'Test.loadData'], a: 1, why: 'stopTest() forces pending async jobs to complete before the test method ends.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 6 - AUTOMATION: FLOWS + APEX                                          */
/* -------------------------------------------------------------------------- */
{
  id: 'automation',
  n: 6,
  title: 'Automation: Flows + Apex',
  icon: '06',
  color: '#F97316',
  tagline: 'Declarative vs imperative, invocable methods',
  guide: '06-Automation-Flows-and-Apex.md',
  art: [
    { label: 'TrainingQuestionTrigger', href: 'force-app/main/default/triggers/TrainingQuestionTrigger.trigger' },
    { label: 'StudyPlanTrigger', href: 'force-app/main/default/triggers/StudyPlanTrigger.trigger' },
    { label: 'CertificationPrepService (invokable-style logic)', href: 'force-app/main/default/classes/CertificationPrepService.cls' },
  ],
  objectives: [
    'Decide Flow vs Apex for a job',
    'Build record-triggered before/after-save flows',
    'Expose Apex to Flows with @InvocableMethod',
    'Mix declarative automations safely',
    'Avoid recursion across mixed automations',
  ],
  lessons: [
    {
      title: 'Flow or Apex?', mins: 8,
      blocks: [
        { t: 'table', head: ['Scenario', 'Best tool'], rows: [
          ['Simple field update on save', 'Before-save Flow'],
          ['Create child records after save', 'After-save Flow'],
          ['Complex multi-object logic + loops', 'Apex'],
          ['HTTP callout mid-process', 'Apex (Flow requires invocable)'],
          ['Recurring batch maintenance', 'Scheduled Flow or Batch'],
        ]},
        { t: 'p', x: 'Rule of thumb: prefer declarative for business logic a power user can maintain; use Apex when the logic needs loops, callouts, or hard to model in Flow.' },
      ]
    },
    {
      title: 'Invocable Methods', mins: 10,
      blocks: [
        { t: 'code', lang: 'apex', x: `public class StudyPlanActions {
    @InvocableMethod(label='Generate 15-phase plan')
    public static void generate(List<Request> reqs) {
        for (Request r : reqs) {
            CertificationPrepService.buildStudyPlan(
                r.learnerId, r.cert, r.targetDate);
        }
    }
    public class Request {
        @InvocableVariable public Id learnerId;
        @InvocableVariable public String cert;
        @InvocableVariable public Date targetDate;
    }
}` },
        { t: 'p', x: '@InvocableMethod allows a Flow to call Apex with typed inputs (@InvocableVariable). One method call per flow element; loop in the Flow if needed.' },
        { t: 'callout', kind: 'warn', x: 'Bulk-safe even here: iterate the request list, gather work, then DML once in the method.' },
      ]
    },
    {
      title: 'Mixing Automations Safely', mins: 9,
      blocks: [
        { t: 'list', items: [
          'Flow updates a field -> Apex trigger fires -> Flow fires again: recursion',
          'Use a suppression registry (TriggerHandlerService) as the guard',
          'Keep ONE automation owner per concern',
          'Test the combined path end-to-end, not each piece alone',
        ]},
      ]
    },
  ],
  quiz: {
    title: 'Phase 6 Quiz - Automation', mins: 5,
    questions: [
      { q: 'A Flow needs to call Apex with typed inputs. Use.',
        opts: ['@RestResource', '@InvocableMethod', '@AuraEnabled', '@TestVisible'], a: 1, why: 'Invocable methods are called by Flow/PB with InvocableVariable inputs.' },
      { q: 'A simple in-memory field default on save is best as.',
        opts: ['Before-save Flow', 'Apex trigger', 'Approval process', 'Workflow rule'], a: 0, why: 'Before-save flows update without an extra DML round-trip.' },
      { q: 'Flow and trigger both update the same field: risk is.',
        opts: ['Compile error', 'Mutual recursion', 'Locking contention', 'Duplicate records'], a: 1, why: 'Each update re-fires the other automation - guard with a suppression flag.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 7 - UI FOUNDATIONS: VISUALFORCE & AURA                                */
/* -------------------------------------------------------------------------- */
{
  id: 'ui',
  n: 7,
  title: 'UI Foundations: VF & Aura',
  icon: '07',
  color: '#EC4899',
  tagline: 'Pages, controllers, events & components',
  guide: '07-UI-Foundations-Visualforce-and-Aura.md',
  art: [
    { label: 'LwcDataService (Aura-compatible @AuraEnabled)', href: 'force-app/main/default/classes/LwcDataService.cls' },
  ],
  objectives: [
    'Build Visualforce pages with standard controllers',
    'Write custom controllers and controller extensions',
    'Understand Aura components, attributes and events',
    'Use @AuraEnabled from an aura:method / client call',
  ],
  lessons: [
    {
      title: 'Visualforce Basics', mins: 10,
      blocks: [
        { t: 'code', lang: 'text', x: `<apex:page controller="AccountPageController">
  <apex:form>
    <apex:inputField value="{!acct.Name}" />
    <apex:commandButton action="{!save}" value="Save" rerender="msg" />
    <apex:outputText id="msg" value="{!msg}" />
  </apex:form>
</apex:page>` },
        { t: 'list', items: [
          'Standard controllers give CRUD + data out of the box',
          'Controller extensions add custom methods to a standard controller',
          'View state is stored server-side; it grows with every bound value',
          'rerender / actionFunction drive partial refreshes',
        ]},
      ]
    },
    {
      title: 'Aura Components', mins: 10,
      blocks: [
        { t: 'code', lang: 'text', x: `<aura:component controller="LwcDataService">
  <aura:attribute name="accounts" type="Account[]" />
  <ui:button label="Load" action="{!c.load}" />
</aura:component>` },
        { t: 'p', x: 'Aura components are the older LWC sibling: markup + a controller.js with action handlers. @AuraEnabled methods are called from the client controller. Application events broadcast across components; component events bubble up a hierarchy.' },
        { t: 'selfcheck', q: 'A child component must tell its parent something happened. Which Aura mechanism?', a: 'A component event fired by the child and handled by the parent.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 7 Quiz - UI Foundations', mins: 5,
    questions: [
      { q: 'Adding custom logic to a standard controller uses a.',
        opts: ['Controller extension', 'New controller', 'Remote action', 'Subflow'], a: 0, why: 'Extensions wrap a standard controller to add methods.' },
      { q: 'An event fired by a child and handled by its parent is.',
        opts: ['Application event', 'Component event', 'Broadcast event', 'Custom event'], a: 1, why: 'Component events bubble locally; application events broadcast globally.' },
      { q: 'Aura/LWC client code calls server logic via.',
        opts: ['@AuraEnabled methods', '@InvocableMethod', 'Database.executeBatch', 'EventBus.publish'], a: 0, why: '@AuraEnabled exposes public static Apex to client calls.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 8 - LIGHTNING WEB COMPONENTS                                          */
/* -------------------------------------------------------------------------- */
{
  id: 'lwc',
  n: 8,
  title: 'Lightning Web Components',
  icon: '08',
  color: '#06B6D4',
  tagline: 'Composition, @wire, imperative calls',
  guide: '08-Lightning-Web-Components.md',
  art: [
    { label: 'LwcDataService', href: 'force-app/main/default/classes/LwcDataService.cls' },
    { label: 'LwcDataServiceTest', href: 'force-app/main/default/classes/LwcDataServiceTest.cls' },
  ],
  objectives: [
    'Distinguish @wire (cacheable) from imperative calls',
    'Know why cacheable=true forbids DML',
    'Read reactive properties and getters',
    'Organize components with composition slots',
  ],
  lessons: [
    {
      title: '@wire vs Imperative', mins: 11,
      blocks: [
        { t: 'code', lang: 'js', x: `import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/LwcDataService.getAccountsWithContacts';

export default class AccountList extends LightningElement {
  @wire(getAccounts) accounts;              // reactive, cached
  // imperative alternative:
  // import call ... ; this.accounts = await getAccounts();
}` },
        { t: 'p', x: '@wire subscribes a property to the streamed result and re-fires when inputs change - repeat calls cost no network. Imperative calls are explicit async awaits.' },
        { t: 'callout', kind: 'warn', x: 'cacheable=true means the Apex method MUST NOT perform DML - wire can re-run many times and mutation would break the cache guarantees.' },
      ]
    },
    {
      title: 'Security & Composition', mins: 9,
      blocks: [
        { t: 'list', items: [
          'Child components receive data via properties / public getters',
          'Child -> parent communication goes through CustomEvent dispatch',
          'lwc:if / lwc:for directives render conditionals and lists',
          'Always let Apex enforce CRUD/FLS - LWC never bypasses it',
        ]},
      ]
    },
  ],
  quiz: {
    title: 'Phase 8 Quiz - Lightning Web Components', mins: 5,
    questions: [
      { q: '@wire is best paired with an Apex method that is.',
        opts: ['@AuraEnabled(cacheable=true)', '@InvokableMethod', 'global without sharing', '@future'], a: 0, why: 'Wire streams cached results, so the method must be cacheable (read-only).' },
      { q: 'A cacheable Apex method may NOT.',
        opts: ['Run SOQL', 'Return records', 'Perform DML', 'Contain a query'], a: 2, why: 'Cacheable = read-only; DML would poison the cache.' },
      { q: 'A child notifies a parent by.',
        opts: ['Dispatching a CustomEvent', 'Setting a boolean', 'Aura application event', 'Lightning message'], a: 0, why: 'CustomEvent bubbles up to parent listeners - the idiomatic LWC pattern.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 9 - TESTING & DEBUGGING                                               */
/* -------------------------------------------------------------------------- */
{
  id: 'test',
  n: 9,
  title: 'Testing & Debugging',
  icon: '09',
  color: '#8B5CF6',
  tagline: '@isTest habits, mocks, coverage gates',
  guide: '09-Testing-and-Debugging.md',
  art: [
    { label: 'IntegrationServiceTest (HttpCalloutMock)', href: 'force-app/main/default/classes/IntegrationServiceTest.cls' },
    { label: 'EventPublisherServiceTest', href: 'force-app/main/default/classes/EventPublisherServiceTest.cls' },
  ],
  objectives: [
    'Write @isTest classes with TestSetup',
    'Isolate with SeeAllData=false and System.runAs',
    'Simulate HTTP with HttpCalloutMock',
    'Pin async behavior with startTest/stopTest',
    'Understand the 75% overall coverage requirement',
  ],
  lessons: [
    {
      title: 'Test Anatomy', mins: 9,
      blocks: [
        { t: 'code', lang: 'apex', x: `@isTest
private class DeveloperFundamentalsTest {
    @TestSetup static void makeData() { /* shared rows */ }
    @isTest static void behaviourUnderTest() {
        // arrange -> act -> assert
        System.assert(condition);
        System.assertEquals(expected, actual);
    }
}` },
        { t: 'p', x: 'By default tests SeeAllData=false: they only see data they create (plus your re-created TestSetup). Assertions are mandatory - a test that never asserts proves nothing.' },
      ]
    },
    {
      title: 'Mocks & Fakes', mins: 10,
      blocks: [
        { t: 'code', lang: 'apex', x: `class MockSuccess implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
        HttpResponse res = new HttpResponse();
        res.setStatusCode(200);
        res.setBody('{"ok":true}');
        return res;
    }
}
@isTest static void myTest() {
    Test.setMock(HttpCalloutMock.class, new MockSuccess());
    // no real network hit - the mock answers every callout
}` },
        { t: 'list', items: [
          'HttpCalloutMock + Test.setMock simulate outbound REST calls',
          'Test.setFixedSearchResults seeds deterministic SOSL',
          'Test.getEventBus().deliver() flushes queued platform events',
          'Test.startTest/stopTest drives async to completion',
        ]},
      ]
    },
    {
      title: 'Coverage & CI Gates', mins: 8,
      blocks: [
        { t: 'code', lang: 'bash', x: `# run the whole suite and print coverage
sf apex run test -c -r json` },
        { t: 'p', x: 'Production deployments require at least 75% overall code coverage. Aim for behaviour-level coverage, not line-gaming. Triggers count: cover the trigger path, not just the service.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 9 Quiz - Testing & Debugging', mins: 5,
    questions: [
      { q: 'A real HTTP callout inside a unit test will.',
        opts: ['Succeed silently', 'Fail for security reasons', 'Be mocked automatically', 'Run in the background'], a: 1, why: 'Callouts are blocked in tests - you must install an HttpCalloutMock first.' },
      { q: 'SeeAllData=false means tests see.',
        opts: ['All org data', 'Only data the test created', 'Only system records', 'Production data'], a: 1, why: 'Isolation: tests only see records they create (plus TestSetup).' },
      { q: 'Required overall coverage to deploy to production is.',
        opts: ['50%', '65%', '75%', '100%'], a: 2, why: 'The platform requires at least 75% total code coverage.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 10 - PERFORMANCE & LARGE DATA VOLUMES                                 */
/* -------------------------------------------------------------------------- */
{
  id: 'perf',
  n: 10,
  title: 'Performance & Large Data Volumes',
  icon: '10',
  color: '#6366F1',
  tagline: 'Selective SOQL, indexes, joins, batch',
  guide: '10-Performance-and-Large-Data-Volumes.md',
  art: [
    { label: 'PerformanceService (Map join + clamp)', href: 'force-app/main/default/classes/PerformanceService.cls' },
    { label: 'PerformanceServiceTest', href: 'force-app/main/default/classes/PerformanceServiceTest.cls' },
  ],
  objectives: [
    'Recognise non-selective queries and index usage',
    'Replace nested loops with Map joins',
    'Apply batch patterns for large data volumes',
    'Read Query Plans to prove selectivity',
    'Stay inside synchronous governor limits',
  ],
  lessons: [
    {
      title: 'Selective Queries & Indexes', mins: 10,
      blocks: [
        { t: 'list', items: [
          'Selective = the engine uses an index (primary key, foreign key, standard index fields)',
          'Add custom indexes or skinny tables where filters are expensive',
          'Compare with Universal Containers pattern: a filter returns <1% of rows that\u2019s healthy, >10% is a full scan',
          'Run EXPLAIN or the Query Plan tool in the Developer Console',
        ]},
      ]
    },
    {
      title: 'The Map Join', mins: 11,
      blocks: [
        { t: 'code', lang: 'apex', x: `// anti-pattern: O(n*m) nested loops
for (Account a : accounts) for (Contact c : contacts) { ... }

// pattern: O(n+m) map join
Map<Id, List<Contact>> byAccount = new Map<Id, List<Contact>>();
for (Contact c : contacts) {
    if (!byAccount.containsKey(c.AccountId)) byAccount.put(c.AccountId, new List<Contact>());
    byAccount.get(c.AccountId).add(c);
}
// then per account: byAccount.get(a.Id)` },
        { t: 'callout', kind: 'tip', x: 'HealthScoreRecalculator (AsyncJobService) is the full bulk pattern: chunked scope + one DML per chunk + zero row limit in start().' },
      ]
    },
    {
      title: 'Governor Targets', mins: 8,
      blocks: [
        { t: 'table', head: ['Limit (sync)', 'Value'], rows: [
          ['SOQL queries', '100'],
          ['SOQL rows returned', '50,000'],
          ['DML statements', '150'],
          ['DML rows processed', '10,000'],
          ['Callouts', '10'],
          ['CPU time', '10 seconds'],
          ['Heap size', '6 MB'],
          ['Apex transactions / trigger bulk', 'one per DML batch'],
        ]},
      ]
    },
  ],
  quiz: {
    title: 'Phase 10 Quiz - Performance', mins: 5,
    questions: [
      { q: 'JOIN over 5k accounts and 50k contacts with nested loops is.',
        opts: ['O(n+m)', 'O(n*m)', 'O(log n)', 'O(1)'], a: 1, why: 'Nested loops multiply; a Map join keeps it O(n+m).' },
      { q: 'A filter the query planner would reject as non-selective includes.',
        opts: ['Id = :x', 'OwnerId = :x', 'RecordType so a scratch field', 'A formula wrapping the indexed field'], a: 3, why: 'Wrapping an indexed field in a formula precludes index usage.' },
      { q: 'Batchable start() avoids the row-count limit because it returns a.',
        opts: ['List<SObject>', 'QueryLocator', 'Set<Id>', 'AsyncRequest'], a: 1, why: 'QueryLocator streams lazily, so the 50k record limit does not apply.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 11 - INTEGRATION & ENTERPRISE PATTERNS                                */
/* -------------------------------------------------------------------------- */
{
  id: 'integration',
  n: 11,
  title: 'Integration & Enterprise Patterns',
  icon: '11',
  color: '#14B8A6',
  tagline: 'Named credentials, callouts, REST, event bus',
  guide: '11-Integration-and-Enterprise-Patterns.md',
  art: [
    { label: 'IntegrationService', href: 'force-app/main/default/classes/IntegrationService.cls' },
    { label: 'InboundRestService', href: 'force-app/main/default/classes/InboundRestService.cls' },
    { label: 'IntegrationLogTrigger', href: 'force-app/main/default/triggers/IntegrationLogTrigger.trigger' },
  ],
  objectives: [
    'Configure Named Credentials and call callout:Name/path',
    'Handle timeouts, status codes and a single retry',
    'Build inbound @RestResource APIs',
    'Use platform events as a decoupled integration channel',
    'Audit every integration attempt on Integration_Log__c',
  ],
  lessons: [
    {
      title: 'Outbound Callouts', mins: 11,
      blocks: [
        { t: 'code', lang: 'apex', x: `HttpRequest req = new HttpRequest();
req.setEndpoint('callout:Dev_API_Endpoint/health'); // named credential
req.setMethod('GET');
req.setHeader('Content-Type', 'application/json');
req.setTimeout(10000);               // don't hang a transaction
HttpResponse res = new Http().send(req);
if (res.getStatusCode() >= 200 && res.getStatusCode() < 300) { ... }` },
        { t: 'p', x: 'Named Credentials hold base URL + auth (OAuth 2.0, basic, cert) in the ORG - secrets never reach source control. Synchronous limit: 10 callouts per transaction (guard it!).' },
        { t: 'selfcheck', q: 'How do you keep API tokens out of git?', a: 'Named Credential referenced as callout:Name/... - auth lives in the org, not in code.' },
      ]
    },
    {
      title: 'Inbound REST APIs', mins: 10,
      blocks: [
        { t: 'code', lang: 'apex', x: `@RestResource(urlMapping='/DevRoadmap/v1/logs/*')
global with sharing class InboundRestService {
    @HttpGet
    global static void doGet() {
        // RestContext.request / response drive the exchange
        // logic lives in global static helpers -> unit-testable
    }
}` },
        { t: 'p', x: 'Expose Apex to external systems with @RestResource and global static doGet/doPost/doDelete/etc. Keep pure logic in testable static helpers because RestContext is not available under test.' },
      ]
    },
    {
      title: 'The Event-Driven Audit Trail', mins: 9,
      blocks: [
        { t: 'p', x: 'Every integration attempt writes an Integration_Log__c row (direction, type, status, endpoint, correlation id, response code). An after-insert trigger publishes Integration_Event__e - dashboards and external clients can subscribe without touching the service.' },
        { t: 'callout', kind: 'tip', x: 'Correlation ids tie your local logs to the external system\u2019s request-id - observability that saves hours in production.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 11 Quiz - Integration', mins: 5,
    questions: [
      { q: 'Synchronous Apex is limited to how many callouts per transaction?',
        opts: ['100', '50', '10', '1'], a: 2, why: 'Ten callouts is the synchronous transaction ceiling.' },
      { q: 'Secrets for external APIs live in.',
        opts: ['Apex constants', 'Named Credentials', 'Custom labels', 'Static resources'], a: 1, why: 'Named Credentials store the auth at runtime and reference endpoint callout:Name/.' },
      { q: 'RestContext is not available in tests, so REST logic should live in.',
        opts: ['The doGet method', 'Global static helper methods', 'Triggers', 'Flows'], a: 1, why: 'Testable helpers let unit tests exercise the same code the endpoint calls.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 12 - RELEASE MANAGEMENT & CI/CD                                       */
/* -------------------------------------------------------------------------- */
{
  id: 'release',
  n: 12,
  title: 'Release Management & CI/CD',
  icon: '12',
  color: '#84CC16',
  tagline: 'Scratch orgs, deployment, pipelines',
  guide: '12-Release-Management-and-CICD.md',
  art: [
    { label: 'manifest/package.xml', href: 'manifest/package.xml' },
    { label: 'sfdx-project.json', href: 'sfdx-project.json' },
    { label: 'config/project-scratch-def.json', href: 'config/project-scratch-def.json' },
  ],
  objectives: [
    'Create scratch orgs from sfdx-project.json sources',
    'Use sf project deploy / retrieve',
    'Understand change sets, CLI and packages',
    'Shape a CI/CD pipeline with quality gates',
    'Enforce 75% coverage + PMD/lint before release',
  ],
  lessons: [
    {
      title: 'The sf CLI Workflow', mins: 9,
      blocks: [
        { t: 'code', lang: 'bash', x: `# authorize a Dev Hub once
sf org login web -d

# create + deploy a scratch org
sf org create scratch -f config/project-scratch-def.json -a dev
sf project deploy start --source-dir force-app -o dev

# quality gate
sf apex run test -c -o dev` },
        { t: 'p', x: 'Source of truth is git. Scratch orgs are disposable dev environments stamped by sfdx-project.json at API 68.0. Never hand-edit production.' },
      ]
    },
    {
      title: 'Deployment Vehicles', mins: 10,
      blocks: [
        { t: 'table', head: ['Vehicle', 'Use for'], rows: [
          ['Change sets', 'Metadata between orgs you control'],
          ['sf project deploy', 'Source-driven deploys in CI'],
          ['Unlocked packages', 'Versioned, installable to any org'],
          ['Managed packages', 'Partner/distribution with namespaces'],
        ]},
        { t: 'callout', kind: 'warn', x: 'Dependencies (custom objects before classes, permission sets before users) matter. manifest/package.xml lets a deploy walk the whole dependency graph.' },
      ]
    },
    {
      title: 'Pipeline Gates', mins: 8,
      blocks: [
        { t: 'list', items: [
          'Lint: eslint for JS/LWC, PMD/Salesforce scanner for Apex',
          'Prettier verify keeps formatting reviews cheap',
          'Deploy to scratch, run the full test suite, assert 75%+',
          'Promote through sandboxes, then production with a release week',
        ]},
      ]
    },
  ],
  quiz: {
    title: 'Phase 12 Quiz - Release Management', mins: 5,
    questions: [
      { q: 'Disposable dev environments built from source are.',
        opts: ['Sandboxes', 'Scratch orgs', 'Change sets', 'Production copies'], a: 1, why: 'Scratch orgs are generated from git sources - fast, disposable, repeatable.' },
      { q: 'Versioned packages installable to any org are.',
        opts: ['Permission sets', 'Unlocked packages', 'Report folders', 'Static resources'], a: 1, why: 'Unlocked (or managed) packages carry version numbers and dependencies.' },
      { q: 'Before production deploy, CI must assert.',
        opts: ['A clean workspace only', '75%+ test coverage and passed tests', 'A green dashboard', 'Two admins'], a: 1, why: 'Coverage + passing tests are the mandatory release gates.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 13 - CERTIFICATION PREP                                               */
/* -------------------------------------------------------------------------- */
{
  id: 'cert',
  n: 13,
  title: 'Certification Prep',
  icon: '13',
  color: '#EF4444',
  tagline: 'Blueprint maps, exam strategy, traps',
  guide: '13-Certification-Prep.md',
  art: [
    { label: 'CertificationPrepService (quiz engine)', href: 'force-app/main/default/classes/CertificationPrepService.cls' },
    { label: 'Training_Question__c', href: 'force-app/main/default/objects/Training_Question__c/' },
    { label: 'Study_Plan__c', href: 'force-app/main/default/objects/Study_Plan__c/' },
  ],
  objectives: [
    'Memorise both exam blueprints and weights',
    'Budget 105 minutes across 60 questions',
    'Avoid the classic traps (bulk, sharing, order of execution)',
    'Run the in-repo quiz engine and study-plan generator',
    'Execute a 7-day exam sprint',
  ],
  lessons: [
    {
      title: 'Blueprint Maps', mins: 9,
      blocks: [
        { t: 'table', head: ['PDI domain', 'Weight'], rows: [
          ['Developer Fundamentals', '27%'],
          ['Process Automation & Logic', '28%'],
          ['User Interface', '25%'],
          ['Testing / Debugging / Deployment', '20%'],
        ]},
        { t: 'table', head: ['PDII domain', 'Weight'], rows: [
          ['Advanced Dev Fundamentals', '15%'],
          ['Process Automation, Logic & Integration', '27%'],
          ['User Interface', '20%'],
          ['Testing / Debugging / Deployment', '20%'],
          ['Performance', '18%'],
        ]},
        { t: 'p', x: 'Both: 60 questions, 105 minutes. PDI pass = 68%, PDII pass = 65%. PDII requires PDI; the old superbadges prerequisite was retired in October 2025.' },
      ]
    },
    {
      title: 'The Top Traps', mins: 11,
      blocks: [
        { t: 'table', head: ['Trap', 'Remember'], rows: [
          ['DML in a loop', 'Gather first, one DML statement'],
          ['Implicit sharing', 'Declare with / without / inherited sharing'],
          ['Order of execution', 'Before triggers > validation > after > assignment > flows'],
          ['Cacheable DML', '@wire methods are read-only'],
          ['SOSL vs SOQL', 'Free-text = SOSL; structured = SOQL'],
          ['Retry everything', 'Only 5xx deserve a single retry'],
        ]},
      ]
    },
    {
      title: 'The Exam Sprint', mins: 9,
      blocks: [
        { t: 'num', items: [
          'Run CertificationPrepService.buildStudyPlan to materialise 13 Phase rows',
          'Fill Training_Question__c with the repo quiz bank + your wrong answers',
          'Daily: 30 scored questions + review every miss via the Explanation__c field',
          'Twice-weekly: full 60-question mock under 105-minute timers',
          'Final 48h: only traps, blueprint weights, and order-of-execution review',
        ]},
        { t: 'callout', kind: 'tip', x: 'Register on Webassessor, run the Pearson VUE system check early, and book the exam 4+ weeks out to keep the sprint honest.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 13 Quiz - Certification Prep', mins: 5,
    questions: [
      { q: 'PDI passing score is.',
        opts: ['60%', '65%', '68%', '75%'], a: 2, why: 'Platform Developer I requires 68%; PDII requires 65%.' },
      { q: 'Which runs second in the Order of Execution?',
        opts: ['Before trigger', 'Validation rules', 'Assignments', 'Flows'], a: 1, why: 'Before triggers run first, validation rules run second.' },
      { q: 'After Process Builder was retired and flows replaced it, a record-triggered Flow runs.',
        opts: ['Before triggers only', 'At step 11, after assignment rules', 'At the very start', 'Never'], a: 1, why: 'Record-triggered flows execute late in the sequence, after after-triggers and assignment rules.' },
    ]
  }
},

/* -------------------------------------------------------------------------- */
/* PHASE 14 - PRACTICAL EXERCISES & MINI PROJECTS                              */
/* -------------------------------------------------------------------------- */
{
  id: 'exercises',
  n: 14,
  title: 'Practical Exercises & Mini Projects',
  icon: '14',
  color: '#059669',
  tagline: '31 exercises, 10 mini projects, 1 capstone',
  guide: '14-Practical-Exercises-and-Mini-Projects.md',
  art: [
    { label: '14-Practical-Exercises-and-Mini-Projects.md', href: 'developer Roadmap/14-Practical-Exercises-and-Mini-Projects.md' },
    { label: '15-Answers-and-Results.md', href: 'developer Roadmap/15-Answers-and-Results.md' },
  ],
  objectives: [
    'Apply fundamentals through graded exercises (★ to ★★★)',
    'Build mini projects combining 2–3 phases of concepts',
    'Complete a capstone project touching all 13 roadmap phases',
    'Practice real scratch-org deployment and testing workflows',
  ],
  lessons: [
    {
      title: 'S1 · Fundamentals & Apex Basics (Phases 1–2)', mins: 28,
      blocks: [
        { t: 'p', x: 'This phase is the hands-on laboratory for every concept in the roadmap. Each section maps to the corresponding theory phase. Exercises are graded ★ (beginner) to ★★★ (advanced). Mini projects combine multiple phases into a single buildable feature.' },
        { t: 'table', head: ['Rating', 'Difficulty'], rows: [
          ['★', 'Beginner — single concept, guided steps'],
          ['★★', 'Intermediate — multiple concepts, some decision-making'],
          ['★★★', 'Advanced — multi-phase integration, design decisions required'],
          ['★★★★', 'Expert — full application across all roadmap phases'],
        ]},
        { t: 'callout', kind: 'tip', x: 'Workflow: complete all ★ exercises before ★★/★★★, do mini projects only after the preceding exercises, and check your work against 15-Answers-and-Results.md after every exercise.' },
        { t: 'ex', id: '1.1', title: 'SOQL Parent-Child Query', stars: 1, obj: 'Query the core Sales Cloud data model with relationship traversal.', steps: [
          'Create a scratch org and deploy source.',
          'Write an anonymous Apex script that creates 3 Accounts with Health_Score__c values of 50, 75 and 90, then creates Contacts: 2 for the first Account, 1 for the second, 0 for the third.',
          'Write a single SOQL query that returns every Account with its child Contacts using a subquery.',
          'Write a second SOQL query that returns every Contact with its parent Account.Name using dot notation.',
          'System.debug the results and count the total contacts across all accounts.',
        ], verify: 'You used exactly 2 SOQL statements. No queries inside loops.' },
        { t: 'ex', id: '1.2', title: 'DML Round Trip with Limits Tracking', stars: 1, obj: 'Master insert, update, upsert, delete, and undelete while tracking governor usage.', steps: [
          'In anonymous Apex, build a List<Account> with 5 records and insert them in ONE statement.',
          'Read them back with one SOQL. Print Limits.getDmlStatements() and Limits.getLimitDMLStatements().',
          'Modify the Health_Score__c field of 3 of the 5 records and update in ONE statement.',
          'Upsert all 5 using their standard Id.',
          'Delete 2 records, then undelete one of them.',
          "Query deleted records: SELECT Id, Name FROM Account WHERE IsDeleted = true ALL ROWS.",
          'Print the final DML statement count and total records processed.',
        ], verify: 'Total DML statements used ≤ 5 (insert + query + update + delete + undelete + ALL ROWS query).' },
        { t: 'ex', id: '1.3', title: 'Collections: List, Set, Map', stars: 2, obj: 'Use all three collection types with sObjects and demonstrate the Map constructor pattern.', steps: [
          'Insert 10 Accounts in one DML statement.',
          'Build a Set<Id> of all Account Ids from the query results.',
          'Build a Map<Id, Account> using the new Map<Id, Account>([SELECT ...]) constructor.',
          'Iterate over accountsById.keySet() and print each Account Name.',
          'Demonstrate containsKey with a valid Id and a bogus Id.',
          'Convert the map to List<Account> via accountsById.values() and verify the size.',
          'Print the CPU time before and after using Limits.getCpuTime().',
        ], verify: 'You never access a record by index after building the map. All lookups use .get(id).' },
        { t: 'ex', id: '1.4', title: 'Sharing Model Smoke Test', stars: 2, obj: 'Observe the difference between with sharing and without sharing.', steps: [
          'Create public with sharing class SharingTestA with public static Integer countAccounts() returning [SELECT COUNT() FROM Account], and public without sharing class SharingTestB with the same method.',
          'From anonymous Apex, run both as admin and print the results — both return the same count.',
          'Write a test class SharingModelTest that creates a low-privilege Standard User profile user in @TestSetup.',
          'Use System.runAs(lowPriv) to call both classes.',
          'Assert that SharingTestA.countAccounts() returns fewer rows than SharingTestB.countAccounts().',
        ], verify: 'The test passes and demonstrates the sharing difference.' },
        { t: 'ex', id: '1.5', title: 'Partial vs All-or-Nothing DML', stars: 2, obj: 'Contrast Database.insert(list, false) with insert list on mixed-validity data.', steps: [
          'Build a list containing 3 valid Account records and 1 record with a Name longer than 255 characters.',
          'Run Database.insert(records, false) and loop the SaveResult[] to print isSuccess() and getErrors() for each record.',
          'Count successes and failures.',
          'Now try insert records (all-or-nothing) inside a try/catch and observe the DmlException behavior.',
          'Assert that the all-or-nothing approach saved 0 records, while the partial approach saved 3.',
        ], verify: 'You can explain why partial DML saved records despite one failure.' },
        { t: 'ex', id: '1.6', title: 'Custom Exception and Error Handling', stars: 2, obj: 'Create and use a custom exception class.', steps: [
          'Create AccountValidationException extends Exception.',
          'Write a method validateAccount(Account a) that throws AccountValidationException if Name is blank or Health_Score__c is outside 0–100.',
          'Call validateAccount from anonymous Apex in a try/catch block for: a blank-name account, a score of 150, and a valid account.',
          'Print the exception message for invalid inputs and "Valid" for the valid one.',
        ], verify: 'Custom exception is caught separately from generic Exception.' },
        { t: 'proj', id: 'MP1', title: 'Account Health Management Service', stars: 3, obj: 'Build a service class that manages Account health scores with full DML, collections, and exception handling.', reqs: [
          'Create AccountHealthService.cls with with sharing.',
          'getAccountsByMinScore(Integer minScore) — query accounts above a threshold.',
          'buildAccountMap(List<Id> accountIds) — returns a Map for O(1) lookups.',
          'normalizeScores(List<Account> accounts) — clamps Health_Score__c to 0–100, sets null to 70.',
          'bulkUpdateScores(Map<Id, Integer> scoreUpdates) — applies score updates in one DML.',
          'calculateAverageScore(List<Account> accounts) — returns the average (handle empty list).',
          'Create AccountHealthServiceTest.cls with @TestSetup creating 10 accounts with varied scores, one test per service method, and assertions on collection sizes, DML counts and edge cases (empty list, null scores).',
        ], success: 'sf apex run test -c shows 100% coverage and all tests pass.' },
      ]
    },
    {
      title: 'S2 · SOQL & SOSL (Phase 3)', mins: 14,
      blocks: [
        { t: 'ex', id: '2.1', title: 'Aggregate Queries with Aliases', stars: 1, obj: 'Write GROUP BY queries and read AggregateResult by alias.', steps: [
          'Create 3 Accounts, each with a different number of Contacts (5, 3, 1).',
          'Write an aggregate SOQL: SELECT AccountId, COUNT(Id) contactCount FROM Contact WHERE AccountId != null GROUP BY AccountId.',
          'Loop the AggregateResult list, casting row.get(\'contactCount\') to Integer.',
          'Write a second aggregate with HAVING COUNT(Id) > 2 and verify only the 5-contact account appears.',
          'Write a query using AVG(Health_Score__c) on Account and cast the result to Decimal.',
        ], verify: 'You read aggregates only by alias, never by source field name.' },
        { t: 'ex', id: '2.2', title: 'Dynamic SOQL with Injection Protection', stars: 2, obj: 'Build safe dynamic queries and demonstrate injection defense.', steps: [
          "Write a method searchAccounts(String searchTerm) that builds the query with String.escapeSingleQuotes:",
          'Call it with TechCorp and verify results.',
          'Call it with \' OR 1=1 -- and verify it returns 0 results (escaped).',
          'Write a second method using bind variables: Database.query(\'SELECT Id, Name FROM Account WHERE Name = :searchTerm\').',
          'Compare the two approaches and document when each is appropriate.',
        ], code: { lang: 'apex', x: `String query = 'SELECT Id, Name FROM Account WHERE Name LIKE \\'%' + String.escapeSingleQuotes(searchTerm) + '%\\' LIMIT 10';
return Database.query(query);` }, verify: 'The escaped version returns 0 results for injection input. The bind version throws for LIKE patterns.' },
        { t: 'ex', id: '2.3', title: 'SOSL Multi-Object Search', stars: 2, obj: 'Use SOSL to search across Account and Contact simultaneously.', steps: [
          'Create an Account named "Northwind Traders" and a Contact named "North Windlass".',
          "Execute SOSL: FIND 'North' IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, FirstName, LastName).",
          'Print results[0] size (Account matches) and results[1] size (Contact matches).',
          'Write a test that uses Test.setFixedSearchResults to stub the SOSL results.',
          'Assert the correct object order in the List<List<SObject>>.',
        ], verify: 'Results[0] is Accounts, results[1] is Contacts. Test passes with fixed results.' },
        { t: 'proj', id: 'MP2', title: 'Universal Search Service', stars: 3, obj: 'Build a search service that combines SOQL and SOSL for a unified search experience.', reqs: [
          'Create SearchService.cls with: searchAcrossObjects(String term) — SOSL across Account, Contact, Lead.',
          'searchAccountsWithChildren(String nameFilter, Integer minContacts) — SOQL with subquery + HAVING.',
          'countRecordsByObject() — aggregate count across standard objects.',
          'Create SearchServiceTest.cls with SOSL tests using Test.setFixedSearchResults, aggregate tests with setup data, and edge cases (empty search term, no matching records).',
        ], success: 'All tests pass; SOSL test uses fixed results; aggregate casts are correct.' },
      ]
    },
    {
      title: 'S3 · Triggers & Order of Execution (Phase 4)', mins: 15,
      blocks: [
        { t: 'ex', id: '3.1', title: 'Before-Trigger Defaulting', stars: 1, obj: 'Set field defaults in a before insert trigger without extra DML.', steps: [
          "Create a trigger AccountDefaultTrigger on Account (before insert) that sets Health_Score__c to 70 when null and Description to 'Auto-created on ' + Date.today() when null.",
          'Insert an Account with only Name set.',
          'Query it back and verify both fields were populated.',
          'Insert 200 Accounts in one list and verify the trigger handled all records (no governor violation).',
        ], verify: 'No second DML was used. The fields are saved with the insert.' },
        { t: 'ex', id: '3.2', title: 'Change Detection in After-Update', stars: 2, obj: 'Act only when a specific field changes, not on every update.', steps: [
          'Study the Code_Review__c object. Create a trigger CodeReviewChangeTrigger on Code_Review__c (after update).',
          'Compare Trigger.oldMap[key].Review_Status__c with Trigger.newMap[key].Review_Status__c.',
          'Only when Review_Status__c changed, create an Integration_Log__c record marking the change.',
          'Update a record changing Comments__c only — verify NO log is created.',
          'Update the same record changing Review_Status__c — verify a log IS created.',
        ], verify: 'Change detection works correctly; unrelated field changes are ignored.' },
        { t: 'ex', id: '3.3', title: 'Recursion Guard Implementation', stars: 3, obj: 'Prevent a trigger from re-entering itself when its own DML fires the trigger again.', steps: [
          'Create RecursionGuard.cls with a private static Set<Id> processedIds.',
          'shouldProcess(Id recordId) — returns true if not yet processed, then adds to the set.',
          'markProcessed(Id recordId) — adds to the set. reset() — clears the set (for testing).',
          'Write a trigger on Account (after update) that updates Description when Health_Score__c changes, guarded by RecursionGuard.',
          'Write a test that updates Health_Score__c and verifies Description was updated exactly once, resetting the guard at the start of each test.',
        ], verify: 'No infinite loop; the trigger fires exactly twice (before validation + after update).' },
        { t: 'proj', id: 'MP3', title: 'Lead Auto-Assignment Engine', stars: 3, obj: 'Build a complete trigger-driven lead routing system.', reqs: [
          'Create custom metadata Lead_Routing_Rule__mdt with Industry__c (text), Owner__c (lookup to User) and Priority__c (number).',
          'Create LeadAutoAssignmentTrigger on Lead (before insert): collect all Industry values, query matching rules sorted by Priority__c, assign OwnerId from the first match, and set Assignment_Source__c to \'Rule: \' + rule.Name.',
          'Create a handler class LeadAssignmentHandler.cls with with sharing.',
          'Write LeadAssignmentHandlerTest.cls with 5 leads across 3 industries (some matching, some not), assertions that matches are assigned and non-matches keep the default owner, plus a bulk test of 200 leads in one insert.',
        ], success: 'Trigger is thin (one line delegating to handler). Handler is bulkified. All tests pass.' },
      ]
    },
    {
      title: 'S4 · Async Apex & Platform Events (Phase 5)', mins: 15,
      blocks: [
        { t: 'ex', id: '4.1', title: 'Queueable Apex Lifecycle', stars: 1, obj: 'Enqueue a job, track it, and handle failures.', steps: [
          'Create SimpleQueueable.cls implementing Queueable with a constructor taking an Async_Job_Monitor__c Id.',
          'In execute, set Job_Status__c = \'Running\', do work, then set Job_Status__c = \'Completed\'.',
          'Add a Boolean shouldFail constructor parameter that causes an exception in execute.',
          'In anonymous Apex, create an Async_Job_Monitor__c with Job_Type__c = \'Queueable\', enqueue the job, wait, then query the monitor to see the status change.',
          'Repeat with shouldFail = true and verify Job_Status__c = \'Failed\' and the error message is captured.',
        ], verify: 'Status transitions work; the exception is caught and recorded.' },
        { t: 'ex', id: '4.2', title: 'Batch Apex with QueryLocator', stars: 2, obj: 'Process a large dataset in chunks using Batch Apex.', steps: [
          'Insert 500 Accounts with varied Health_Score__c values.',
          "Create ScoreBatch.cls implementing Database.Batchable<sObject>: start returns Database.getQueryLocator('SELECT Id, Health_Score__c FROM Account'); execute clamps scores to 0–100 and sets null to 70 in one DML; finish logs completion.",
          'Execute with scope 200 and count how many batches ran.',
          'Execute with scope 2000 and compare.',
          'Assert all accounts have valid scores after batch completion.',
        ], verify: 'Scope 200 = 3 batches. Scope 2000 = 1 batch. All scores are 0–100.' },
        { t: 'ex', id: '4.3', title: 'Platform Event Round Trip', stars: 2, obj: 'Publish events and verify the subscriber materializes records.', steps: [
          'Create a platform event Test_Notification__e with Message__c (text) and Source__c (text).',
          'Create TestNotificationTrigger on Test_Notification__e (after insert) that creates an Integration_Log__c for each event with Payload__c = evt.Message__c.',
          'In anonymous Apex, publish 5 events in ONE EventBus.publish call.',
          'Query Integration_Log__c and verify 5 records were created.',
          'Add a recursion guard using TriggerHandlerService.suppress / restore.',
        ], verify: '5 events → 5 log records. No infinite loop.' },
        { t: 'proj', id: 'MP4', title: 'Data Sync Pipeline', stars: 3, obj: 'Build an end-to-end data synchronization pipeline using Queueable, Batch, and Platform Events.', reqs: [
          'Create SyncConfig__c custom metadata with Object_Name__c, Last_Sync_Date__c and Batch_Size__c.',
          'Build DataSyncService.cls with startSync(String objectName) that reads the config, enqueues a Queueable which updates Last_Sync_Date__c and publishes a Sync_Event__e platform event.',
          'The Sync_Event__e subscriber trigger creates an Integration_Log__c entry.',
          'Write DataSyncServiceTest.cls using Test.startTest()/Test.stopTest(); assert the config was updated, the event was published and materialized as a log.',
          'Handle the recursion guard between the event subscriber and the log trigger.',
        ], success: 'Full pipeline works: enqueue → config update → event publish → log creation. No recursion.' },
      ]
    },
    {
      title: 'S5 · Automation: Flows & Apex (Phase 6)', mins: 14,
      blocks: [
        { t: 'ex', id: '5.1', title: '@InvocableMethod for Flow', stars: 1, obj: 'Expose an Apex method to Flow Builder.', steps: [
          'Create ScoreCalculatorService.cls with an @InvocableMethod that takes List<Request> and returns List<Result>.',
          'Request inner class: @InvocableVariable public Integer rawScore. Result inner class: @InvocableVariable public Integer clampedScore.',
          'Create a test class that calls the method directly (static Apex call) and asserts clamping behavior.',
          'Test edge cases: null input, negative, 0, 100, 150.',
        ], code: { lang: 'apex', x: `@InvocableMethod(label='Calculate Score' description='Clamps a score to 0-100.')
public static List<Result> calculate(List<Request> requests) {
    // clamp each rawScore to 0..100 and return as Result
}` }, verify: 'Method is static, takes List<Request>, returns List<Result>. All edge cases pass.' },
        { t: 'ex', id: '5.2', title: 'Flow vs Trigger Decision Matrix', stars: 2, obj: 'Document when to use Flow vs Apex for a set of scenarios.', steps: [
          '(a) Set Health_Score__c to 70 when a new Account is created with a blank score.',
          '(b) Send a custom email to the Account owner when the score drops below 30.',
          '(c) Recalculate scores for all Accounts nightly in a batch.',
          '(d) Show a screen collecting user input before creating a Contact.',
          '(e) Call an external API when an Opportunity closes.',
          '(f) Create 3 child records when an Account is created.',
          'For each scenario write a 1-sentence justification defending Flow or Apex.',
          'For (a) and (b) build both a before-save Flow AND a before-trigger, then compare the DML footprint.',
        ], verify: 'You can defend each choice with a specific Apex/Flow limitation or advantage.' },
        { t: 'proj', id: 'MP5', title: 'Onboarding Wizard', stars: 3, obj: 'Build a screen Flow that collects user input and calls invocable Apex.', reqs: [
          'Create OnboardingService.cls with an @InvocableMethod taking Company Name, Contact Name and Industry that creates an Account and Contact in one transaction and returns the Account Id.',
          'Create a Screen Flow Onboarding_Wizard: Screen 1 (Company Name required, Industry picklist), Screen 2 (Contact First Name / Last Name required), Apex Action calling OnboardingService, Screen 3 showing "Account created: {!accountId}".',
          'Write OnboardingServiceTest.cls covering the invocable method, and deploy both the Apex class and the Flow metadata.',
        ], success: 'Flow is activatable; Apex test passes; the invocable creates both records.' },
      ]
    },
    {
      title: 'S6 · UI: Visualforce, Aura & LWC (Phases 7–8)', mins: 22,
      blocks: [
        { t: 'ex', id: '6.1', title: 'Visualforce Custom Controller', stars: 1, obj: 'Build a search page with a custom controller.', steps: [
          'Create AccountSearchController.cls with public properties searchTerm (String) and accounts (List<Account>), and a search() method querying Accounts by Name LIKE :searchTerm with limit 50.',
          'Create AccountSearchPage.page with controller="AccountSearchController", an input bound to {!searchTerm}, a command button calling {!search} with reRender="results", a pageBlockTable rendering {!accounts} with Name and Industry columns, and apex:pageMessages.',
          'Open the page in the browser and test a search.',
        ], verify: 'Partial page refresh works (reRender). No full page reload on search.' },
        { t: 'ex', id: '6.2', title: 'Aura Component with Server Call', stars: 2, obj: 'Build an Aura component that calls @AuraEnabled Apex.', steps: [
          'Create AccountAuraController.cls with an @AuraEnabled(cacheable=true) getTopAccounts() returning the top 10 Accounts by Health_Score__c.',
          'Create an Aura component accountAuraList with an init handler calling c.getTopAccounts, an aura:iteration rendering each Account Name/Score, and an aura:registerEvent for AccountSelected.',
          'Create the AccountSelected application event definition.',
          'On row click, fire the application event with the Account Id.',
        ], code: { lang: 'apex', x: `@AuraEnabled(cacheable=true)
public static List<Account> getTopAccounts() {
    return [SELECT Id, Name, Health_Score__c FROM Account
            ORDER BY Health_Score__c DESC LIMIT 10];
}` }, verify: '$A.enqueueAction returns data. Application event fires on click.' },
        { t: 'ex', id: '6.3', title: 'LWC with Wire and Imperative', stars: 2, obj: 'Build an LWC with both @wire (read) and imperative (write) paths.', steps: [
          'Create LwcAccountList with @wire calling LwcDataService.getAccountsWithContacts, a lightning-datatable displaying accounts, and wire {data, error} handling.',
          'Add a "Refresh" button that calls refreshApex to force re-fetch.',
          'Add an imperative "Create Test Account" button that calls an @AuraEnabled (non-cacheable) method and then refreshApex.',
          'Write the .js-meta.xml targeting lightning__AppPage, then deploy and add to a page via App Builder.',
        ], verify: 'Wire loads data on init. Imperative creates a record. Refresh shows updated data.' },
        { t: 'ex', id: '6.4', title: 'LWC Parent-Child Communication', stars: 2, obj: 'Pass data down with @api and up with CustomEvent.', steps: [
          'Create parent accountManager and child accountCard.',
          'Parent passes account to child via @api account.',
          'Child renders account details and has a "Delete" button.',
          'On delete, child dispatches CustomEvent(\'accountdelete\', { detail: this.account.Id }).',
          'Parent handles onaccountdelete and removes the account from its tracked list.',
          'Verify the child re-renders when the parent list changes.',
        ], verify: 'Data flows down via @api and up via CustomEvent. No imports needed for event dispatch.' },
        { t: 'proj', id: 'MP6', title: 'Full-Stack Account Dashboard', stars: 3, obj: 'Build a complete dashboard with Visualforce, Aura, and LWC approaches.', reqs: [
          'Visualforce AccountDashboard.page: account list with health scores, inline edit of Health_Score__c with save, apex:commandButton + reRender.',
          'Aura accountDashboardAura: wired data load, application event for selection, child detail panel showing the selected Account Contacts.',
          'LWC accountDashboardLwc: @wire + lightning-datatable, imperative save, refreshApex after save, custom event for selection.',
          'All three share the same @AuraEnabled Apex controller.',
          'Write tests for the controller methods.',
        ], success: 'All three UI approaches work. Controller is shared. Tests pass.' },
      ]
    },
    {
      title: 'S7 · Testing & Debugging (Phase 9)', mins: 16,
      blocks: [
        { t: 'ex', id: '7.1', title: '@TestSetup and Data Isolation', stars: 1, obj: 'Verify SeeAllData=false behavior.', steps: [
          'Create DataIsolationTest.cls with @TestSetup inserting 3 Accounts.',
          'onlySetupDataVisible: query all Accounts and assert exactly 3 exist (no org data leaked).',
          'secondTestSeesSameSetupData: assert exactly 3 exist (setup data shared across methods).',
          'addingRecordsWithinMethod: insert 2 more, query and assert 5 total (3 setup + 2 method-level).',
        ], verify: 'All three assertions pass. Data isolation is proven.' },
        { t: 'ex', id: '7.2', title: 'Test.startTest/stopTest for Queueable', stars: 2, obj: 'Force async completion and verify fresh governor limits.', steps: [
          'Write a test that enqueues SimpleQueueable(monitorId) between Test.startTest() and Test.stopTest().',
          'Inside the test, print Limits.getQueries() before and after Test.startTest() and verify the governor counters reset in the start/stop window.',
          'Assert the Async_Job_Monitor__c record has Job_Status__c = \'Completed\'.',
        ], code: { lang: 'apex', x: `Test.startTest();
System.enqueueJob(new SimpleQueueable(monitorId));
Test.stopTest();
// assertions here — job has completed synchronously` }, verify: 'Without startTest/stopTest, the assertion would fail (job not yet executed).' },
        { t: 'ex', id: '7.3', title: 'HTTP Callout Mock', stars: 3, obj: 'Mock an external API and test retry logic.', steps: [
          'Create MockApiService implements HttpCalloutMock: first call returns 502, second returns 200, tracking the attempt count.',
          'Write a test using Test.setMock(HttpCalloutMock.class, new MockApiService()) and assert the callout succeeds.',
          'Assert the Integration_Log__c record shows Retry_Count__c = 1.',
          'Create a second mock MockApiFailAll that always returns 500.',
          'Test that after retries the result is success = false.',
        ], verify: 'Both mocks are installable. Retry count is accurate in the log.' },
        { t: 'proj', id: 'MP7', title: 'Comprehensive Test Suite', stars: 3, obj: 'Write tests for the Lead Auto-Assignment Engine (Mini Project 3).', reqs: [
          '@TestSetup creates 3 Users (admin, standard, read-only), 5 Lead Routing Rules across 4 industries, and 10 Leads (some matching, some not).',
          'leadsWithMatchingRulesAreAssignedCorrectly — assert OwnerId matches the rule.',
          'leadsWithoutMatchingRulesKeepDefaultOwner — assert owner is the running user.',
          'bulkInsertHandles200Leads — insert 200 leads, assert no governor violations.',
          'updateTriggerReEvaluatesAssignment — change Lead Industry and verify reassignment.',
          'recursionGuardPreventsInfiniteLoop — trigger update that would re-fire, assert stable.',
          'All assertions use System.assertEquals with descriptive messages.',
        ], success: 'sf apex run test -c shows ≥75% coverage. All tests green.' },
      ]
    },
    {
      title: 'S8 · Performance & Large Data Volumes (Phase 10)', mins: 13,
      blocks: [
        { t: 'ex', id: '8.1', title: 'Query Plan Analysis', stars: 1, obj: 'Compare selective vs non-selective queries.', steps: [
          'Insert 500 Accounts with varied Industries and Health Scores.',
          'Open Developer Console → Query Plan and paste each query, recording the cost: Health_Score__c > 50 (indexed field), Name LIKE \'%Corp%\' (leading wildcard), Name LIKE \'Corp%\' (no leading wildcard), and Health_Score__c > 50 AND Industry = \'Technology\' (compound).',
          'Add a custom index on Health_Score__c and re-plan the first query.',
          'Document the cost differences.',
        ], verify: 'Leading wildcard shows highest cost. Indexed field shows lowest.' },
        { t: 'ex', id: '8.2', title: 'Map Join vs Nested Loop', stars: 2, obj: 'Measure the performance improvement of Map joins.', steps: [
          'Insert 10 Accounts and 500 Contacts distributed across them.',
          'Write nestedLoopJoin(List<Account>, List<Contact>) using an O(n*m) nested loop matching c.AccountId == a.Id, tracking Limits.getCpuTime() before and after.',
          'Write mapJoin(...) that builds a Map<Id, List<Contact>> by AccountId and looks up via map.get(acc.Id), also tracking CPU time.',
          'Call both in a test and print both CPU times.',
          'Assert the map join is faster.',
        ], verify: 'Map join CPU time is significantly lower than the nested loop.' },
        { t: 'proj', id: 'MP8', title: 'LDV Migration Tool', stars: 3, obj: 'Build a batch process that migrates Account data with performance monitoring.', reqs: [
          'Create AccountMigrationBatch.cls implementing Database.Batchable<sObject>, Database.Stateful: start returns a QueryLocator over all Accounts; execute transforms data (normalizes names, clamps scores), uses a Map for child Contact lookups and updates in one DML; finish logs total records, total CPU and total DML statements.',
          'Instance fields track totalRecords, totalBatches and maxCpuInBatch.',
          'Create AccountMigrationTest.cls inserting 500 accounts with contacts, running the batch with scope 200, asserting normalized data and accurate Stateful counters.',
          'Monitor with Async_Job_Monitor__c.',
        ], success: 'Batch processes all records. Stateful counters are accurate. Performance is within limits.' },
      ]
    },
    {
      title: 'S9 · Integration & Enterprise Patterns (Phase 11)', mins: 17,
      blocks: [
        { t: 'ex', id: '9.1', title: 'Named Credential Callout', stars: 1, obj: 'Make a callout using a Named Credential.', steps: [
          'In Setup → Named Credentials, create Mock_API pointing to a mockable endpoint.',
          'Write an anonymous Apex block that calls callout:Mock_API/test and debugs the status and body.',
          'Inside a test, mock the callout and assert the response.',
          "Verify the Integration_Log__c captures the endpoint and status.",
        ], code: { lang: 'apex', x: `HttpRequest req = new HttpRequest();
req.setEndpoint('callout:Mock_API/test');
req.setMethod('GET');
Http http = new Http();
HttpResponse res = http.send(req);
System.debug('Status: ' + res.getStatusCode());
System.debug('Body: ' + res.getBody());` }, verify: 'Named Credential reference works without hardcoded URLs. Log entry is created.' },
        { t: 'ex', id: '9.2', title: 'REST Resource CRUD', stars: 2, obj: 'Build an inbound REST API with full CRUD operations.', steps: [
          'Create @RestResource(urlMapping=\'/MyService/v1/items/*\') with @HttpGet (list), @HttpPost (create, return 201 + Id), @HttpPatch (update by Id from URI), @HttpDelete (delete by Id from URI).',
          'Write RestServiceTest.cls calling the service methods directly (not via HTTP) using RestContext.request / RestContext.response.',
          'Verify each verb produces the correct status code (200, 201, 204) and records.',
        ], verify: 'Each verb works. Status codes are correct (200, 201, 204).' },
        { t: 'ex', id: '9.3', title: 'Event-Driven Integration Pipeline', stars: 3, obj: 'Build a publish-subscribe pipeline with audit logging.', steps: [
          'Study the repo pipeline: IntegrationService → Integration_Log__c → IntegrationLogTrigger → EventPublisherService → Integration_Event__e → IntegrationEventSubscriberTrigger → Integration_Log__c.',
          'Reproduce this pipeline for a new custom object Webhook_Event__e.',
          'Add recursion guards at every trigger level.',
          'Write a test that publishes 10 events, verifies 10 log entries, verifies no infinite recursion, and asserts correlation IDs are consistent.',
        ], verify: 'Pipeline works end-to-end. Recursion guards are effective.' },
        { t: 'proj', id: 'MP9', title: 'External API Hub', stars: 3, obj: 'Build a complete integration layer with outbound callouts, inbound REST, and event-driven sync.', reqs: [
          'Outbound ExternalApiService.cls: Named Credentials, retry logic (5xx → retry once → log failure), Correlation Id tracking, Integration_Log__c audit trail.',
          'Inbound WebhookReceiver.cls: @RestResource receiving external webhooks, validates the payload, creates a Webhook_Event__e, returns 200 on success / 400 on bad payload.',
          'Event Subscriber WebhookEventTrigger on Webhook_Event__e creates Integration_Log__c with direction \'Inbound\', with a recursion guard via TriggerHandlerService.',
          'Test suite: mock for outbound callouts, REST context simulation for inbound, event publish + subscriber assertion, and the end-to-end pipeline (callout → log → trigger → event → subscriber → log).',
        ], success: 'All tests pass. Pipeline is fully auditable. No recursion.' },
      ]
    },
    {
      title: 'S10 · Release Management & CI/CD (Phase 12)', mins: 13,
      blocks: [
        { t: 'ex', id: '10.1', title: 'Scratch Org Lifecycle', stars: 1, obj: 'Create, deploy, test, and destroy a scratch org.', steps: [
          'sf org create scratch -f config/project-scratch-def.json -a test1 -d 1',
          'sf project deploy start --source-dir force-app --target-org test1',
          'sf apex run test -c --target-org test1 --test-level RunLocalTests --result-format human',
          'Record the coverage percentage.',
          'sf org delete scratch --target-org test1 --no-prompt',
          'Repeat steps 1–5 with a second scratch org (test2) to prove the process is repeatable.',
        ], verify: 'Both orgs created and destroyed. Coverage is consistent.' },
        { t: 'ex', id: '10.2', title: 'Destructive Deployment', stars: 2, obj: 'Remove metadata via destructive changes.', steps: [
          'Create a dummy class StaleHelper.cls (empty class) and deploy it to a scratch org.',
          'Verify it exists in the coverage report.',
          'Create destructiveChanges.xml listing StaleHelper as an ApexClass member with the correct API version.',
          'Create an empty package.xml for the same API version.',
          'Deploy both files together, then verify StaleHelper no longer exists.',
        ], code: { lang: 'xml', x: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>StaleHelper</members>
        <name>ApexClass</name>
    </types>
    <version>68.0</version>
</Package>` }, verify: 'Class is removed from the org. Deployment succeeds with both files.' },
        { t: 'proj', id: 'MP10', title: 'Full CI/CD Pipeline', stars: 3, obj: 'Set up a GitHub Actions CI/CD pipeline for the repo.', reqs: [
          'Create .github/workflows/ci.yml triggered on push to main and pull_request: checkout → install SF CLI → authorize DevHub → create scratch org → deploy → lint → test with coverage → scan → teardown.',
          'Add a package.json lint script: "lint": "eslint force-app/**/*.js".',
          'Add an sf scanner step for Apex static analysis.',
          'Configure the pipeline to fail on lint errors, test failures, and coverage below 75%.',
          'Add a separate deploy-prod job that runs only on main push (not PRs), uses sf project deploy start --test-level RunLocalTests, and includes a manual approval gate (GitHub Environments).',
        ], success: 'Pipeline runs on PR. Lint/test/scan gates work. Deploy-prod requires approval.' },
        { t: 'callout', kind: 'tip', x: 'Done with every section? Move on to the capstone — it combines all 13 phases into one buildable application. Solutions for every exercise are in 15-Answers-and-Results.md.' },
      ]
    },
    {
      title: 'Capstone · Certification Quiz Platform', mins: 24,
      blocks: [
        { t: 'p', x: 'The capstone is a single application that touches every phase of the roadmap: data model, service layer, SOQL/SOSL, triggers, async, flows, three UI approaches, testing, performance, integration, and CI/CD. Build it section by section and check the answers file after each milestone.' },
        { t: 'proj', id: 'CAP', title: 'Certification Quiz Platform', stars: 4, obj: 'Build a complete quiz application using every phase of the roadmap.', reqs: [
          { h: 'Phase 1–2 · Data Model & Apex', items: [
            'Custom objects: Quiz__c, Question__c, Answer__c, Quiz_Result__c.',
            'Relationships: Quiz → Questions (master-detail), Question → Answers (master-detail).',
            'Service class with full CRUD, collections, and custom exceptions.',
          ]},
          { h: 'Phase 3 · SOQL & SOSL', items: [
            'Query questions by difficulty, domain, and certification type.',
            'SOSL for full-text search across question text.',
            'Aggregate queries for score statistics.',
          ]},
          { h: 'Phase 4 · Triggers', items: [
            'Before-insert trigger on Question__c to validate and normalize text.',
            'After-update trigger on Quiz_Result__c to publish a notification event.',
          ]},
          { h: 'Phase 5 · Async & Events', items: [
            'Queueable job to calculate quiz statistics.',
            'Platform event Quiz_Completed__e published after quiz submission.',
            'Batch job for nightly statistics aggregation.',
          ]},
          { h: 'Phase 6 · Flows', items: [
            '@InvocableMethod for quiz scoring callable from Flow.',
            'Screen Flow for the quiz-taking wizard.',
          ]},
          { h: 'Phases 7–8 · UI', items: [
            'LWC quiz interface with @wire for questions and imperative submit.',
            'Aura component for the leaderboard.',
            'Visualforce page for admin question management.',
          ]},
          { h: 'Phase 9 · Testing', items: [
            '@TestSetup with question bank.',
            'HTTP mock for external scoring API.',
            'System.runAs for multi-user quiz scenarios.',
            '100% coverage with meaningful assertions.',
          ]},
          { h: 'Phase 10 · Performance', items: [
            'Map joins for answer grouping.',
            'Batch job for large-scale statistics.',
            'Index-aware queries.',
          ]},
          { h: 'Phase 11 · Integration', items: [
            'REST API for external quiz submission.',
            'Platform events for quiz completion notifications.',
            'Integration log audit trail.',
          ]},
          { h: 'Phase 12 · CI/CD', items: [
            'GitHub Actions pipeline.',
            'Destructive changes for deprecated quiz versions.',
            'Package versioning.',
          ]},
        ], success: 'sf apex run test -c shows ≥75% coverage with all tests passing; all metadata deploys cleanly; the LWC renders in a scratch org; the REST endpoint is callable from Postman; the pipeline runs without errors.' },
        { t: 'callout', kind: 'warn', x: 'Review the common-mistakes checklist at the end of 15-Answers-and-Results.md before starting the capstone — it points out the exact pitfalls (recursion, loop DML, non-bulk queries) this project is designed to catch.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 14 Quiz - Practical Application', mins: 5,
    questions: [
      { q: 'Which DML approach allows partial success?',
        opts: ['insert list', 'Database.insert(list, true)', 'Database.insert(list, false)', 'update single record'], a: 2, why: 'Database.insert with allOrNothing=false returns SaveResult[] and allows partial success.' },
      { q: 'A before trigger can modify Trigger.new fields with.',
        opts: ['Zero extra DML', 'One extra DML', 'Two extra DML', 'No DML possible'], a: 0, why: 'Before triggers edit Trigger.new in memory; the platform saves the changes with the original DML.' },
      { q: 'To prevent trigger recursion, use.',
        opts: ['A static Set<Id> guard', 'System.runAs', 'Database.Stateful', 'Test.startTest'], a: 0, why: 'A static Set<Id> persists across trigger invocations within a transaction, preventing re-entry.' },
      { q: 'In Test.setFixedSearchResults the returned List<List<SObject>> groups results by.',
        opts: ['Alphabetically', 'Object order in the RETURNING clause', 'Row count', 'Modified date'], a: 1, why: 'Each inner list maps to the object order declared in the SOSL RETURNING clause (Accounts first, then Contacts).' },
    ]
  }
},

/* PHASE 15 - ANSWERS & RESULTS                                                */
/* -------------------------------------------------------------------------- */
{
  id: 'answers',
  n: 15,
  title: 'Answers & Results',
  icon: '15',
  color: '#7C3AED',
  tagline: 'Complete solutions for every exercise',
  guide: '15-Answers-and-Results.md',
  art: [
    { label: '15-Answers-and-Results.md', href: 'developer Roadmap/15-Answers-and-Results.md' },
  ],
  objectives: [
    'Verify exercise solutions with complete Apex code',
    'Understand common mistakes and how to avoid them',
    'Review expected debug output and test assertions',
    'Study the common mistakes reference table',
  ],
  lessons: [
    {
      title: 'Fundamentals & Apex Answers (Sections 1–2)', mins: 12,
      blocks: [
        { t: 'p', x: 'Complete solutions for Exercises 1.1–1.6 and Mini Project 1, plus Exercises 2.1–2.3 and Mini Project 2. Each answer includes full Apex code, test classes, and expected output.' },
        { t: 'list', items: [
          'Anonymous Apex scripts ready to run in Developer Console',
          'SOQL queries with expected row counts',
          'Test classes with @TestSetup and assertions',
          'Custom exception classes and error handling patterns',
        ]},
        { t: 'callout', kind: 'tip', x: 'Copy-paste the anonymous Apex scripts directly into the Developer Console → Execute Anonymous window to see results instantly.' },
      ]
    },
    {
      title: 'Triggers, Async & Events Answers (Sections 3–4)', mins: 12,
      blocks: [
        { t: 'p', x: 'Complete trigger code, handler classes, recursion guards, Queueable implementations, Batch Apex, and platform event publish/subscribe patterns.' },
        { t: 'list', items: [
          'AccountDefaultTrigger — before insert defaulting with bulk support',
          'CodeReviewChangeTrigger — Trigger.oldMap change detection',
          'RecursionGuard.cls — static Set<Id> pattern',
          'SimpleQueueable.cls — lifecycle with success and failure paths',
          'ScoreBatch.cls — QueryLocator batch with scope comparison',
          'TestNotificationTrigger — event-to-log materialization',
        ]},
      ]
    },
    {
      title: 'UI, Testing & Performance Answers (Sections 5–8)', mins: 14,
      blocks: [
        { t: 'p', x: 'Solutions for @InvocableMethod, Visualforce pages with controllers, Aura components with $A.enqueueAction, LWC with @wire and imperative calls, test isolation, HTTP mocking, Query Plan analysis, and Map join performance.' },
        { t: 'list', items: [
          'ScoreCalculatorService — @InvocableMethod with Request/Result inner classes',
          'AccountSearchController + AccountSearchPage — VF search with reRender',
          'accountAuraList component — init handler + application event',
          'LWC accountListLwc — @wire + refreshApex + imperative create',
          'MockApiService — HttpCalloutMock with retry logic',
          'PerformanceService — nestedLoopJoin vs mapJoin with CPU comparison',
        ]},
      ]
    },
    {
      title: 'Integration, CI/CD & Capstone Answers (Sections 9–10)', mins: 12,
      blocks: [
        { t: 'p', x: 'Solutions for Named Credential callouts, @RestResource CRUD endpoints, event-driven integration pipelines, scratch org lifecycle, destructive deployments, and the CI/CD GitHub Actions workflow.' },
        { t: 'list', items: [
          'MyRestResource.cls — @HttpGet/@HttpPost/@HttpPatch/@HttpDelete',
          'MockApiService + MockApiFailAll — HttpCalloutMock implementations',
          'destructiveChanges.xml + package.xml — removal workflow',
          '.github/workflows/ci.yml — full CI/CD pipeline',
          'Common mistakes reference table covering all 31 exercises',
        ]},
        { t: 'callout', kind: 'tip', x: 'The Common Mistakes table at the end of 15-Answers-and-Results.md is a quick-reference checklist — review it before attempting the capstone project.' },
      ]
    },
  ],
  quiz: {
    title: 'Phase 15 Quiz - Solutions Review', mins: 3,
    questions: [
      { q: 'The Common Mistakes table in the answers file covers how many exercises?',
        opts: ['10', '20', '31', '50'], a: 2, why: 'The table lists one common mistake per exercise, covering all 31 exercises across 10 sections.' },
      { q: 'Anonymous Apex scripts in the answers can be run in.',
        opts: ['VS Code terminal only', 'Developer Console → Execute Anonymous', 'GitHub Actions', 'Flow Builder'], a: 1, why: 'Anonymous Apex scripts are designed for the Developer Console Execute Anonymous window or sf apex run.' },
      { q: 'The capstone project requires which minimum coverage?',
        opts: ['50%', '65%', '75%', '100%'], a: 2, why: '75% is the production deployment requirement; the capstone asserts this as the success criteria.' },
    ]
  }
},

];

/* value-added summary fields for the UI */
ACADEMY.forEach(m => {
  m.total = m.lessons.length;
  m.quizTotal = m.quiz.questions.length;
});