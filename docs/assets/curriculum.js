/* ============================================================================
 * Developer I & II Academy - Curriculum data
 * 13 phases following the `developer Roadmap/` guides. Content is condensed
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
    @InvocableMethod(label='Generate 13-phase plan')
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

];

/* value-added summary fields for the UI */
ACADEMY.forEach(m => {
  m.total = m.lessons.length;
  m.quizTotal = m.quiz.questions.length;
});