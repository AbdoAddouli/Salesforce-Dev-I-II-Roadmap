# Phase 6: Automation — Flows and Apex

Salesforce automation is a spectrum. The declarative end (Flow Builder) handles most record plumbing without code; the imperative end (Apex) handles the rest. The exam demands you know both sides, the mechanics of calling Apex from Flow, and the exact order in which automation executes.

## Learning Objectives

By the end of this phase, you will be able to:
- Decide when a Flow is enough and when Apex is required.
- Describe Flow Builder element types and which Flow "triggers" run before vs after save.
- Order the automation stack: assignment, auto-response, workflow, flows, escalation.
- Write `@InvocableMethod`/`@InvocableVariable` Apex and call it as a Flow Apex action.
- Account for Flow history and the Process Builder retirement.
- Follow the "Apex vs Flow" decision checklist for any given requirement.

## 1. Declarative vs Imperative: The First Decision

**Declarative automation** = configuration the platform runs for you: validation rules, workflows (legacy), **Flow Builder** flows, assignment rules, escalation rules, auto-response rules, entitlement rules, and Process Builder (legacy, see below). No deployment of runnable code; administrators can build and tweak it; every change is a metadata deployment.

**Imperative automation** = Apex triggers, classes, and integration code: when the logic needs loops, custom classes, package `global` behavior, DML shaped by arbitrary conditions, callouts, cryptography, or performance control that declarative tools cannot express.

The platform's own guidance (and the exam's stance):

| Requirement | Lean toward |
|-------------|-------------|
| Simple field update on record change | Flow (before-save fast field update) |
| Multi-step, multi-record orchestration | Flow |
| Screen / wizard collection of user input | Flow (screen flow) |
| Scheduled, recurring batch of millions | Apex batch/jobs |
| Public API endpoints | Apex `@RestResource` |
| Complex loops / math / external data | Apex |
| Re-usable logic used by flows AND triggers | Apex service (callable from both) |

The cert question is usually phrased "which is the correct approach for this scenario" — the winning answer is almost always **the simplest one that satisfies the requirements**, and when a flow can do it, the flow is the "most appropriate" answer over a trigger.

## 2. Flow Builder Fundamentals

Flow Builder has **three "trigger-type" templates** that matter for automation ordering:

- **Record-Triggered Flows** – run when a record is created/updated/deleted. May be **before-save** or **after-save**.
  - *Before-save*: runs before validation; can only use Fast Field Updates (fields modified are saved with the record) and cannot do DML. This is Flow's analogue of the before trigger.
  - *After-save*: runs after the record is committed; may perform DML, invoke Apex, publish platform events.
- **Scheduled-Triggered Flows** – run on a schedule or after a time delay (Flow's equivalent of schedulable Apex).
- **Autolaunched (No Trigger) Flows** – invoked manually by buttons, processes, another flow (**subflows**), or Apex.

Core elements: **Assignment** (set field values), **Decision** (branching), **Record Create/Update/Delete** (DML), **Get Records** (SOQL-ish reads), **Loop**, **Screen**, **Subflow**, **Apex Action** (calls invocable Apex), **Platform Event**, **Formula/Resource** (variables). Every flow has typed **resources**: input variables, output variables, and local variables.

Flow ordering slots into the order of execution (Phase 4) *after* workflow rules and *before* entitlement rules for after-save evaluation; **before-save record-triggered flows evaluate before the save's validation**.

## 3. The Automation Order (What Runs When)

Recap the exam-relevant sequence after an after-save DML reaches this stage:

1. before triggers
2. validation rules
3. after triggers
4. assignment rules
5. auto-response rules
6. **workflow rules (legacy)**
7. re-save for workflow field updates (re-fires triggers)
8. before/after triggers for workflow-created records
9. escalation rules
10. **record-triggered flows / process builder**
11. entitlement rules
12. roll-up summary + criteria-based sharing
13. formula recalculation
14. commit

Flow-specific trap questions:

- A **before-save record-triggered flow** fires *before* validation and can only Fast-Field-Update — it cannot create related records.
- An **after-save flow** can create records, call Apex, and publish events, and it runs after workflow rules have done their field updates.
- **Flow field updates = another record save = more trigger invocations.** A loop of re-saves is exactly where recursion guards and Flow "no update if unchanged" settings save you.

## 4. Calling Apex from a Flow: Invocable Methods

Any Apex class can expose a static method to Flow with two annotations:

```apex
public with sharing class QuestionSanitizerService {

    @InvocableMethod(
        label='Sanitize Training Questions',
        description='Trims question text and fills default answer/difficulty before ask.'
    )
    public static List<SanitizeResult> sanitize(
        List<SanitizeRequest> requests
    ) {
        List<SanitizeResult> results = new List<SanitizeResult>();
        for (SanitizeRequest req : requests) {
            results.add(doSanitize(req));
        }
        return results;
    }

    public class SanitizeRequest {
        @InvocableVariable(label='Question Text')
        public String questionText;
        @InvocableVariable(label='Correct Answer')
        public String correctAnswer;
    }

    public class SanitizeResult {
        @InvocableVariable(label='Cleaned Text')
        public String cleanedText;
    }
}
```

Rules the exam will hold you to:

- `@InvocableMethod` is a **`static` method** that takes **one `List<Request>`** argument and **must return a `List<Result>`** (for sidebar-verbose calls) or `List<sObject>`/void for typical invocations.
- Input/output shapes are **inner classes** whose fields carry `@InvocableVariable(label=...)` — the label is what the Flow action builder displays.
- Per-instance "payload" for screens: with the dialog label, Flow sends a `List` containing the inputs; your method is always called **once with the whole list**, so bulkify.
- Visibility: `@InvocableMethod` methods are called *cross-namespace/packaged*; either `public`/`global`. **Sharing is honoured** — an invocable class declared `with sharing` runs in the invoking user's context.
- No `@InvocableVariable` name clash with reserved words (`Label`, `API Name`, `Type`, `Design`, others).
- The catch: invocable methods execute inside whatever flow context calls them, so they inherit the flow's limits budget (an after-save flow calling DML-heavy Apex consumes the sync transaction's governors).

## 5. Flow Calling Patterns vs Direct DML

A Flow that needs to call Apex can (a) invoke an **invocable method** (most common), (b) call a **platform event** (decoupled), or (c) call an Apex **REST endpoint** via HTTP callout. Meanwhile Apex can *start* a flow only through `Flow.Interview` for autolaunched flows:

```apex
Map<String, Object> inputs = new Map<String, Object>{ 'LearnerId' => someUserId };
Flow.Interview myInterview = Flow.Interview.createInterview('My_Autolaunched_Flow', inputs);
myInterview.start();
```

Direct-DML discipline in Flow mirrors Apex: use **collections** for bulk updates rather than per-record CRUD elements; bias toward `Get Records` with filter logic instead of querying inside loops; keep *screens* minimal in record-triggered flows.

## 6. Process Builder History and Flow Migration

**Process Builder** is Salesforce's older click-based process tool. Salesforce has retired it from active use: new processes should always be built as Flows, and existing Process Builders are candidates for **migration to Flow** because Flows are the functional successor (with Flow's trigger templates, subflows, and visibility features). Your exam vocabulary:

- Process Builder = legacy, built on the same rule-and-actions model as workflow rules, Evaluate "When a record is created" / "created or updated" / "created, and every time it's edited".
- **Workflow Rules**, older still, support only a subset (email alerts, tasks, field updates, outbound messages) on create/update with a "fire once" every-time option.
- **Flows** supersede both; the platform shows a deprecation-style warning for new Process Builder creation, and long-term support favours Flow.

The trickiest exam scenario — "which declarative tool when the field update must also respect a criteria and the result feeds a formula on the same record": Flow before-save wins; Process Builder is legacy; validation rules can't write fields.

## 7. Flow Element Reference and Runtime Behaviour

Compact enough to memorise before the exam:

| Flow element | What it does | Bulk/DML note |
|--------------|--------------|----------------|
| **Decision** | Branch on record fields, formulas, or collected data | no side effects |
| **Assignment** | Set a resource/record field | in-memory only |
| **Get Records** | SOQL-style read (`Source = Object`, filter logic) | returns up to 10,000 for the flow's query budget |
| **Record Create/Update/Delete** | DML on a single record or a collection | loops of Record Create = loop DML (avoid in later releases with "Create Records; collection" mode) |
| **Loop** | iterate over an array | keep body DML outside |
| **Apex Action** | invoke an `@InvocableMethod` | inherits flow's limits |
| **Subflow** | call another flow, pass variables | shared resources |
| **Platform Event** | publish an event in-flow | counts against the event publish budget |
| **Screen** | collect/mark user input | interactive only in screen flows |

Runtime facts: **record-triggered flows run inside the triggering transaction** (before-save or after-save); faults and errors in the after-save case can roll the transaction back unless you add error handling (fault paths); platform *rollback* of a failed flow mirrors Apex's all-or-nothing save. When a flow reaches its bulk-data edge (large collections, 10k query rows in one Get), the correct answer on the exam is "move this to Apex/batch" — flows are declarative, not a scale tool.

## 8. Full Invocable Example Pattern

The production-grade pattern to reproduce in your head: one input class, one output class, `@InvocableMethod` static, bulk list-in/list-out, **with sharing** (honours the invoking user):

```apex
public with sharing class HealthScoreAutoService {

    @InvocableMethod(
        label='Calculate Account Health',
        description='Recalculates Health_Score__c from an input value.'
    )
    public static List<Result> calculate(List<Request> requests) {
        List<Result> results = new List<Result>();
        for (Request req : requests) {
            Integer raw = req.rawScore;
            Integer clamped = raw == null ? 70 : Math.min(100, Math.max(0, raw));
            results.add(new Result(clamped));
        }
        return results;
    }

    public class Request {
        @InvocableVariable(label='Raw Score' required=true)
        public Integer rawScore;
    }

    public class Result {
        @InvocableVariable(label='Health Score')
        public Integer healthScore;
        public Result(Integer v) { this.healthScore = v; }
    }
}
```

Why this exact shape matters: the exam asserts the method **must be static**, take exactly **`List<Input>`**, return **`List<Output>`** (or void for side-effect only), and declare `@InvocableVariable` on inner-class fields. Code samples that misuse `List<Input> calculate()`, take a single record, or return `Integer` are wrong as drawn.

## 9. Flow Security and Governance Checklist

- **Sharing**: flows run in *system context* by default? No — **flows run with the running user's sharing unless "Run As" is set to system**. The before-save/after-save distinction is privilege-relevant: after-save flows run as the user; system context only for explicitly configured runs. FDIs want you to check "does this flow respect the user's permissions" — the answer depends on its **Run As** setting.
- **FLS**: flow fields respect the user's field visibility when the flow runs in user context.
- **Volume**: flows are constrained by the same transaction; never use Flow to move "millions".
- **Deployment**: flows deploy as `flow-meta.xml` source under `force-app/main/default/flows/`; the repo's `flows/` folder is the natural home when you add one (Exercise 1).
- **Versioning**: flows version; activating a new version is a metadata event (deployable, reviewable, rollback-able) — a hallmark of "reliable declarative automation".

## Hands-On Exercises

### Exercise 1: Build a before-save record-triggered flow

1. In a scratch org, create a Record-Triggered Flow on `Account` (created/updated, before-save).
2. Add a Fast Field Update setting `Health_Score__c` to 70 when blank.
3. Deploy it as source (`force-app/main/default/flows/`), retrieve it, and read the `flow-meta.xml` to see the "runInSystem=default, recordTriggerType" declarations.

### Exercise 2: Invoke Apex from a Flow

1. Add the `QuestionSanitizerService` class above to `force-app/main/default/classes/` and deploy it.
2. Create an autolaunched flow with an **Apex Action** element pointing at `Sanitize Training Questions`.
3. Wire a few inputs and confirm the sanitised output for text with leading/trailing spaces.
4. Confirm the class must be `static`, list-in/list-out — trace the mapping of `@InvocableVariable` labels to the Flow UI.

### Exercise 3: Compare DML discipline (Flow vs Apex)

1. In the same org, build an after-save record-triggered flow on `Opportunity` that creates one `Integration_Log__c` row per changed record using a List. 
2. Reproduce the same logic with a trigger delegating to `EventPublisherService.publishIntegrationEvents` for the identical data volume.
3. Notice the DML-statement accounting: Flow's Record Create element issues one DML statement per record group; Apex's bulk single statement handles the whole list.

### Exercise 4: Trace the automation stack

1. Add a field-update workflow rule and a before-save flow to the same `Account` field, then trigger a DML.
2. Inspect the debug log ordering: workflow before flows, re-save behaviour, trigger firings.
3. Note what changes when the workflow rule is migrated to a Flow (order becomes flows-only).

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Declarative automation** | Platform configuration that runs rules/flows without compiled code. |
| **Flow Builder** | Current declarative tool for record-triggered, scheduled, autolaunched, and screen flows. |
| **Record-triggered flow** | Flow firing on create/update/delete; before-save (Fast Field Updates only) or after-save. |
| **Fast Field Update** | Before-save field modification saved with the triggering record's DML. |
| **Autolaunched flow** | Flow invoked on demand (buttons, Apex `Flow.Interview`, subflows) with no trigger. |
| **`@InvocableMethod`** | Annotation exposing a static Apex method to Flow as an Apex Action. |
| **`@InvocableVariable`** | Annotation marking an inner-class field as an input/output to the flow action. |
| **Process Builder** | Retired legacy declarative process tool; migrate to Flow. |
| **Workflow Rules** | Legacy rules supporting field updates, email alerts, tasks, and outbound messaging. |
| **Flow.Interview** | Apex API to launch an autolaunched flow programmatically. |
| **Subflow** | A flow invoked from within another flow, sharing variables. |

## Certification Checkpoints

- [ ] I can name the Flow templates and which are before-save vs after-save aware.
- [ ] I can write an `@InvocableMethod` signature, its input class, and its output class from memory.
- [ ] I know the automation order: assignment → auto-response → workflow → flows → escalation.
- [ ] I can state one task only Apex can do and one only Flow should do.
- [ ] I can explain when a before-save flow cannot perform DML and why that mirrors before triggers.
- [ ] I can describe Process Builder's retirement status and Flow's successor role.
- [ ] I know `Flow.Interview` is how Apex starts an autolaunched flow.