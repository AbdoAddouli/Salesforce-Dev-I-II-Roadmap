# Phase 13: Certification Prep

Both certifications, one finish line. This phase consolidates everything into exam-shaped knowledge: the exact requirements, the weight of every domain, pacing arithmetic, trap topics, a memory map, a 7-day plan, and the operational details of exam day—with the repo's own quiz and study-plan machinery as your rehearsal ground.

## Learning Objectives

By the end of this phase, you will be able to:
- State the exact exam facts (questions, minutes, passing score, cost, prerequisites) for PDI and PDII.
- Budget time per question and design a mock-exam answering strategy.
- Recognise the highest-frequency trap topics and their correct answers.
- Assemble a memory map of the always-tested concepts.
- Execute a structured 7-day preparation plan.
- Register on Webassessor, understand TestVue (Pearson VUE) logistics, and know the Superbadge status.

## 1. The Two Exams, Side by Side

| | Platform Developer I | Platform Developer II |
|--|----------------------|------------------------|
| Questions | 60 | 60 |
| Minutes | 105 | 105 |
| Passing score | **68%** (~41 of 60) | **65%** (~39 of 60) |
| Cost | **$200** | **$200** (requires a passing PDI) |
| Prerequisite | none | **Platform Developer I held/certified**; Superbadges no longer required since **October 2025** |
| Update cadence | 3 releases per year (trail to latest quarterly API) | 3 releases per year |
| Exam vendor | Pearson VUE / Webassessor (online or test centre) | same |

Registration lives at Webassessor (webassessor.com, exam code accessible from your Salesforce certification account; the trailhead/`certification.salesforce.com` dashboard links through). If you retake, Pearson VUE handles rebooking; results post to your certification history.

## 2. Domain Weights: Where the Points Actually Are

**Platform Developer I weightings:**

| Domain | Weight |
|--------|--------|
| Developer Fundamentals | 27% |
| Process Automation & Logic | 28% |
| User Interface | 25% |
| Testing, Debugging & Deployment | 20% |

**Platform Developer II weightings:**

| Domain | Weight |
|--------|--------|
| Advanced Developer Fundamentals | 15% |
| Process Automation & Logic / Integration | 27% |
| User Interface | 20% |
| Testing, Debugging & Deployment | 20% |
| Performance | 18% |

Interpretation for your study budget: **PDI is a "logic + UI" exam**; **PDII is an "integration + performance" mastery exam**. The repo's phases map 1:1 onto PDI domains, and Phases 10–11 (performance, integration) carry the extra PDII weight—do not skim them.

PDI question volume by domain (~60 total): roughly 16 fundamentals, 17 process/logic, 15 UI, 12 testing/deployment. That maths alone tells you why Phase 4 (order of execution) and Phase 7/8 (UI) matter more than your "favourite" topic.

## 3. Pacing: 105 Minutes, 60 Questions

105 ÷ 60 ≈ **1.75 minutes per question** (~"1:45"). Workable tactics:

1. **First pass**: answer everything you know instantly (target ≤ 60 s each). Flag the uncertain ones mentally (or via the exam UI's mark-for-review).
2. **Second pass**: the money questions — scenario and code-analysis items get your full attention.
3. **Never leave blanks**: there is no penalty for guessing; a 50/50 guess at 68% passing is worth a lot.
4. **Watch the multi-select**: questions phrased "Select two" / "Select three" are scored all-or-nothing. Under-select deliberately only when truly unsure; over-selecting guarantees a loss.
5. **Budget a 15-minute reserve** for review; do not dwell on a single hard question past ~2 minutes—return later.

## 4. Question Pattern Analysis

Candidates almost always see four archetypes:

| Pattern | Shape | Attack |
|---------|-------|--------|
| Recall/fact | "Which governor limits..." | anchored memory table (Phase 10) |
| Scenario | "A batch job must..." | name the *best-fit* tool, prize simplicity |
| Code reading | "What does this Apex print/throw?" | trace order of execution + context variables + sharing first, then limits |
| Best practice / anti-pattern | "Which method demonstrates..." | spot the loop-SOQL / loop-DML / non-cacheable-DML immediately |

The wrong-answer pool is engineered: one is *almost* right but misuse a keyword (`object vs sObject`, `global vs public`, second `!=` on nulls), one is the reverse of the correct choice (declarative vs imperative), and the distractor carries a plausible-but-wrong detail (e.g. future methods can accept `List<sObject>`). Eliminate by **reading the extreme words**: "must", "only", "every", "always" are disproved by a single exception.

## 5. Top Trap Topics (Memorise These Cold)

- **Order of execution** — before triggers precede validation; after triggers precede assignment/auto-response/workflow/flows; workflow field updates re-run the whole save (Phase 4 step debate). Recite the sequence twice in the exam bathroom.
- **"Always bulk"** — any snippet with SOQL or DML inside a `for` loop is wrong on the exam, regardless of how the question wraps it.
- **Sharing model** — `without sharing` does **not** bypass CRUD/FLS; `with sharing` does **not** grant access; `inherited sharing` adopts the caller. Quote all three in one answer only when asked.
- **Limits** — the sync numbers (100 SOQL, 150 DML stmts, 10k DML rows, 50k query rows, 6 MB heap, 10 s CPU, 10 callouts) and the async upgrades (200, 150, 10k/chunk, n/a via QueryLocator, 12 MB, 60 s, 10).
- **`stripInaccessible`** — `Security.stripInaccessible(Security.AccessType.READABLE, records)` returns `SObjectAccessDecision`; use it *before* handing records to a user-exposed surface; it strips fields, not the whole record.
- **Cacheable = no DML** — a wire-method tagged `@AuraEnabled(cacheable=true)` that `insert`s → `callout`d-only error; PDII counts "find the cacheable DML" among its top scores.
- **POLLUTION traps**: method hidden by `private` when the question expects `global`; `DELETE` on non-deletable; `upsert` without external id on a field that isn't an External ID; `LIKE '%x%'` offered as "selective" (it isn't).
- **`Test.startTest/stopTest`** — a queueable test without them asserts before the job runs (Phase 5/9).
- **Platform-event recursion** — a subscriber that re-publishes the same event type loops forever; guard with the suppress registry.

## 6. The Memory Map

Draw these five frames on scrap paper (the exam provides an erasable board at the test centre; you are allowed to write them down):

```
1. ORDER OF EXECUTION
 load -> system validation -> save(uncommitted) -> before triggers ->
 validation rules -> after triggers -> assignment -> auto-response ->
 workflow (field updates re-enter triggers) -> new-record triggers ->
 escalation -> flows/process -> entitlement -> roll-up summary ->
 formula recalc -> commit

2. SHARING
 with    = enforce user's record access
 without = ignore record access (STILL enforced CRUD/FLS)
 inherited = caller's mode
 system context (without/tests/anon) sees all records

3. LIMITS (sync)
 SOQL 100 | DML 150 | DML rows 10k | query rows 50k | heap 6 MB
 CPU 10 s | callouts 10 | SOSL 20

4. UI BRIDGE
 LWC wire  = cacheable @AuraEnabled, no DML, {data,error}
 imperative = plain @AuraEnabled, DML OK, Promise
 Aura events: component / application / broadcast

5. INTEGRATION
 callout:NCName endpoint, 10 sync callouts, Named Credential principal
 REST resource: global static + @Http*
 platform events: EventBus.publish(list)
 Bulk 2.0 (volumes) vs Composite (25 subs) vs Composite Graph (all-or-nothing)
```

## 7. Good Mock-Exam Strategy

- **Simulate exactly**: 60 questions, 105-minute countdown, no phone, one desk. Two full mocks minimum.
- **Score review is the point**: analyse every miss into one of four buckets — *fact gap* (memorise), *misread* (slow down), *priority* (was near-instinct on a low-yield item), *question tech* (multi-select/all-or-nothing discipline).
- Track per-domain accuracy and steer the next study block toward the *weighted* weak domain (PDI: process/logic first; PDII: integration/performance first). A 70% across a 27% domain is worse than 60% across a 15% one.
- Use spaced repetition for the trap tables above; the second mock should be visibly faster on them.

## 8. The 7-Day Plan

Use the repo's own `Study_Plan__c` machinery: call `CertificationPrepService.buildStudyPlan(learnerId, 'Platform Developer I | II', targetDate)` (creates all 13 phases at `Weekly_Goal_Hours__c = 8`), then drive `recordStudyProgress(planId, completedLessons)` daily so `Progress__c` visualises your run.

- **Day 1** — Memory map refresh; re-read Phases 1–4 (fundamentals, Apex, SOQL, triggers).
- **Day 2** — Re-read Phases 5–6 (async, flows); build an async test with `Test.startTest/stopTest` by hand.
- **Day 3** — Re-read Phases 7–8 (UI); lock the wire/imperative split and event types.
- **Day 4** — Re-read Phases 9–10 (testing, performance); drill all governor numbers and `Limits` idioms.
- **Day 5** — Re-read Phases 11–12 (integration, release); hand-write a `HttpCalloutMock` and a `package.xml`.
- **Day 6** — Mock exam #1 (60/105 scoring to the real thresholds); targeted re-read of the weakest weighted domain; mock exam #2 if energy allows.
- **Day 7** — Trap-topic list reread, one final all-tests run (`sf apex run test -c` must stay green), sleep, hydrate.

## 9. Exam-Day Logistics

- Register at **Webassessor** via your Salesforce certification dashboard; choose online-proctored (TestVue/Pearson VUE's proctoring platform) or a centre.
- **Required at the test centre**: valid government-issued photo ID (name must match registration), nothing else in the room; no phones, watches, or notes. Centres provide scratch paper or an erasable whiteboard.
- **Online-proctored**: clean desk, closed door, single screen, quiet room; the proctor checks the space and your webcam framing before the exam begins.
- Setup the environment the *day before* (Webassessor system test); a camera/mic/network failure at the 00:00 moment is your worst-case exam-day risk.
- **Break/later-booking note**: PDI → PDII requires your PDI result; book PDII only after your first certification posts. No Superbadge requirement remains — the October 2025 removal ended that prerequisite permanently.
- On the day: arrive early, use the bathroom, take the full 105 minutes, and re-check flagged questions rather than racing to the finish.

## 10. Your In-Repo Quiz Engine

`force-app/main/default/classes/CertificationPrepService.cls` plus the `Training_Question__c` object is a genuine quiz platform:

- `getQuestionsByCertification('Platform Developer I')` / `('Platform Developer II')` — pulls active questions filtered by `Certification_Target__c`.
- `scoreQuiz(Map<Id,String>)` — grades your submitted answers against `Correct_Answer__c` and returns `QuizOutcome{correct, total, score}` in one round trip.
- `sanitizeTrainingQuestions` (via `TrainingQuestionTrigger`) trims and defaults each question before it lands.
- `buildStudyPlan` materialises the full 13-phase `Study_Plan__c` set in a *single bulk insert* — your study tracker, coded exactly as the "no DML in a loop" rule demands.

Seed a bank of ~40 questions per certification from this roadmap, run the quiz, and use `scoreQuiz` percentages as your day-6/7 signal. When `scoreQuiz` ≥ 80% and `sf apex run test -c` still shows green, you are scoring-pattern ready — book the exam.

## Hands-On Exercises

### Exercise 1: Score a mock

1. Insert ten `Training_Question__c` rows covering Phases 3, 4, 7, 8, 10, 11 semantics.
2. Build a `Map<Id,String>` of your answers; call `CertificationPrepService.scoreQuiz`.
3. Convert `score` to the exam threshold (PDI 68 / PDII 65) and compute how many of the 60 you'd have passed on a scaled basis.

### Exercise 2: Build your study plan

1. `CertificationPrepService.buildStudyPlan(UserInfo.getUserId(), 'Platform Developer II', Date.today().addDays(14))`.
2. Query `Study_Plan__c` ordered by `Phase_Number__c`; call `recordStudyProgress` to mark Phase 1–5 complete.
3. Validate `Progress__c` increments and the before-insert defaults (Phase 1, 'Not Started') held.

### Exercise 3: Trap-topic speed drill

1. For each trap in Section 5, write one exam-styled question with four options where two are plausible-but-wrong.
2. Trade with a partner; time each other at ≤ 90 seconds per question and discuss the eliminate-first method.

### Exercise 4: The 60/105 mock ritual

1. Assemble 60 questions (40% from your quiz bank, 25% from this repo's test assertions, 35% self-authored over trap topics).
2. Sit the full 105 minutes, unplugged, scored to the 68/65 thresholds.
3. Write a one-paragraph post-mortem listing the two weighted domains you revisit in the following 24 hours.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **PDI / PDII** | Platform Developer I / II certifications (60 q, 105 min, $200; PDI 68%, PDII 65% with PDI prerequisite). |
| **Webassessor** | Pearson VUE registration/proctoring portal for Salesforce exams. |
| **Passing score** | The percentage bar (68 PDI / 65 PDII) your raw correct count must clear. |
| **Domain weight** | Percentage of questions per exam section telling you where to study. |
| **Multi-select scoring** | All-or-nothing credit; over-selection forfeits the question. |
| **Trap topic** | High-frequency, deliberately disorienting concept (bulk, sharing, cacheable-DML, limits, order of execution). |
| **Memory map** | Hand-drawn frames (order of execution, sharing, limits, UI bridge, integration) written down during the exam. |
| **Mock exam** | A full 60/105 timed run scored to the real threshold. |
| **Superbadge prerequisite** | Retired October 2025; no longer required before PDII exams. |
| **`QuizOutcome`** | `CertificationPrepService` inner class reporting `correct`/`total`/`score` from `scoreQuiz`. |
| **`Training_Question__c`** | The repo's question-bank object powering the quiz engine. |
| **`Study_Plan__c`** | The object that stores one row per roadmap phase and tracks `Progress__c`. |

## Certification Checkpoints

- [ ] I can state all PDI/PDII exam facts (60/105/68·65%/200/prereqs/superbadge status).
- [ ] I can recite the PDI and PDII domain weights without hesitation.
- [ ] I have sat at least one timed 60/105 mock and scored it to threshold.
- [ ] I can draw the order-of-execution memory map from memory.
- [ ] I can name the five sync governor numbers and their async upgrades.
- [ ] I can list at least eight trap topics and their correct answers.
- [ ] I have used `CertificationPrepService.scoreQuiz` and `buildStudyPlan` from this repo.
- [ ] I know my registration portal (Webassessor), exam vendor (TestVue), and what to bring on exam day.