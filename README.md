# Salesforce Developer I & II RoadMap

A hands-on learning repository that maps the **Salesforce Platform Developer I (PDI)** and **Platform Developer II (PDII)** certification paths, one phase at a time - all as deployable, commented, test-covered Salesforce metadata.

Built to mirror the structure and teaching style of the [Salesforce Sales Cloud RoadMap](https://github.com/AbdoAddouli/Salesforce-SalesCloud-RoadMap), but for the *developer* track.

## Exams

| Exam | Questions | Minutes | Pass | Cost | Prerequisite |
|------|-----------|---------|------|------|--------------|
| Platform Developer I | 60 | 105 | 68% | $200 | None |
| Platform Developer II | 60 | 105 | 65% | $200 | Platform Developer I |

Superbadges retired as a PDII requirement: October 2025.

## Project Structure

```
force-app/main/default/
├── classes/           10 commented Apex service classes + 11 test classes
├── triggers/          7 triggers (trigger-handler + recursion-guard pattern)
├── objects/           5 custom objects, 1 platform event, custom fields on standards
└── ...
config/                scratch org definition (API 68.0)
manifest/              package.xml deployment manifest
scripts/               SOQL & Apex teaching scripts
developer Roadmap/     per-phase study guides
docs/                  companion learning site
```

## The 13 phases

1. Developer Fundamentals
2. Apex Language Essentials
3. SOQL & SOSL
4. Triggers & Order of Execution
5. Async Apex & Platform Events
6. Automation: Flows + Apex
7. UI Foundations: Visualforce & Aura
8. Lightning Web Components
9. Testing & Debugging
10. Performance & Large Data Volumes
11. Integration & Enterprise Patterns
12. Release Management & CI/CD
13. Certification Prep

## What is already in the repo

- **10 Apex service classes** covering the full PDI/PDII syllabus: SOQL/SOSL, trigger handler framework, async Apex, platform events, integrations, inbound REST, LWC controllers, performance, security & sharing, and a certification quiz/study-plan engine.
- **7 triggers** demonstrating bulk-safe patterns, suppression and recursion guards.
- **11 test classes** with `@TestSetup`, `Test.startTest()/stopTest()`, `HttpCalloutMock`, `Test.setFixedSearchResults`, and managed-sharing round-trips.
- **155 object/field metadata files**: `Async_Job_Monitor__c`, `Integration_Log__c`, `Code_Review__c`, `Training_Question__c`, `Study_Plan__c`, the `Integration_Event__e` platform event, plus custom fields on Account, Contact, Lead, Opportunity, Case, Task, Event, Campaign, and User.

## Quick start

```bash
# Create a scratch org
sf org create scratch -f config/project-scratch-def.json -a dev

# Deploy everything
sf project deploy start --source-dir force-app

# Run the test suite (asserts 75%+ coverage locally)
sf apex run test -c

# Run the in-org certification quiz / study plan generator (Phase 13)
# via CertificationPrepService + Training_Question__c / Study_Plan__c
```

## Teaching style

Every class is written like a lecture: the header comment explains *why* the pattern matters, the keywords the exam uses, and the governor-limit implications. Every test is named after the behaviour it proves. Read order: service header comment, its test, then the trigger that wires it in.

## License

Free to use for personal certification study.