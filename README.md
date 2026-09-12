# Salesforce Developer I & II RoadMap

A complete, hands-on learning roadmap to master **Salesforce Development** — from zero to **Platform Developer I (PDI)** and **Platform Developer II (PDII) certification-ready** — using real SFDX metadata, commented Apex services and triggers, practice SOQL/Apex, and a 13-phase structured study plan.

![Salesforce CLI](https://img.shields.io/badge/Salesforce%20CLI-✓-00A1E0?logo=salesforce)
![API Version](https://img.shields.io/badge/API%20Version-68.0-00A1E0)
![Apex Classes](https://img.shields.io/badge/Apex-21%20classes-1798c1)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## 📘 Overview

This repository is a **learning lab**, not just documentation. Every concept covered in the roadmap comes with **deployable metadata** you can push to a free Developer Edition org or scratch org, run in **Flow Builder / Reports / Approval**, and study line-by-line in **commented Apex classes**, **triggers**, and **practice SOQL scripts**.

> **Who is this for?**
> - Beginners starting from zero on the Salesforce platform
> - Apex developers learning triggers, async Apex, and integrations
> - Developers prepping for **Salesforce Platform Developer I** then **Platform Developer II**
> - Anyone who wants real, test-covered metadata — not just slides

> **Scope** — The full developer journey: Apex & SOQL → triggers & order of execution → async Apex & platform events → UI (Visualforce / Aura / LWC) → testing & debugging → performance → integrations → release management → certification prep.

 > **Duration** — ~13 weeks, self-paced (each phase is one week of study + hands-on labs). Phases 14–15 provide practical exercises and complete answers for every topic.

---

## 🏗️ Architecture

Curious how it all fits together? See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the visual diagrams:

- Layered architecture (UI → Automation → Apex → Data)
- Full data model (ER diagram: standard + custom objects)
- Trigger → Service wiring
- End-to-end developer workflow
- Integration & certification-prep architectures

> **🎮 Interactive version** — explore the curriculum live at
> **[`https://abdoaddouli.github.io/Salesforce-Dev-I-II-Roadmap/`](https://abdoaddouli.github.io/Salesforce-Dev-I-II-Roadmap/)**
> built from `docs/` (15 modules, quizzes, search, progress tracking).

---

## 🧭 The 15-Phase Learning Roadmap

| Phase | Topic | Guide | Key Concepts |
|------:|-------|-------|--------------|
| 1 | **Developer Fundamentals** | [01-Developer-Fundamentals.md](./developer%20Roadmap/01-Developer-Fundamentals.md) | Platform, data model, security model, limits |
| 2 | **Apex Language Essentials** | [02-Apex-Language-Essentials.md](./developer%20Roadmap/02-Apex-Language-Essentials.md) | Classes, collections, exceptions, DML |
| 3 | **SOQL & SOSL** | [03-SOQL-and-SOSL.md](./developer%20Roadmap/03-SOQL-and-SOSL.md) | Queries, aggregates, relationships, injection |
| 4 | **Triggers & Order of Execution** | [04-Triggers-and-Order-of-Execution.md](./developer%20Roadmap/04-Triggers-and-Order-of-Execution.md) | Trigger contexts, bulk safety, save order |
| 5 | **Async Apex & Platform Events** | [05-Async-Apex-and-Platform-Events.md](./developer%20Roadmap/05-Async-Apex-and-Platform-Events.md) | Queueable, batch, scheduled, events |
| 6 | **Automation: Flows + Apex** | [06-Automation-Flows-and-Apex.md](./developer%20Roadmap/06-Automation-Flows-and-Apex.md) | Flows, invocable Apex, automation best practices |
| 7 | **UI Foundations: Visualforce & Aura** | [07-UI-Foundations-Visualforce-and-Aura.md](./developer%20Roadmap/07-UI-Foundations-Visualforce-and-Aura.md) | Visualforce, Aura, controllers |
| 8 | **Lightning Web Components** | [08-Lightning-Web-Components.md](./developer%20Roadmap/08-Lightning-Web-Components.md) | LWC, wire, decorators, data binding |
| 9 | **Testing & Debugging** | [09-Testing-and-Debugging.md](./developer%20Roadmap/09-Testing-and-Debugging.md) | `@isTest`, `@TestSetup`, coverage, logs |
| 10 | **Performance & Large Data Volumes** | [10-Performance-and-Large-Data-Volumes.md](./developer%20Roadmap/10-Performance-and-Large-Data-Volumes.md) | Bulk DML, limits, indexes, big data patterns |
| 11 | **Integration & Enterprise Patterns** | [11-Integration-and-Enterprise-Patterns.md](./developer%20Roadmap/11-Integration-and-Enterprise-Patterns.md) | REST/SOAP, callouts, retries, events |
| 12 | **Release Management & CI/CD** | [12-Release-Management-and-CICD.md](./developer%20Roadmap/12-Release-Management-and-CICD.md) | Salesforce DX, package.xml, CI, scratch orgs |
| 13 | **Certification Prep** | [13-Certification-Prep.md](./developer%20Roadmap/13-Certification-Prep.md) | PDI & PDII blueprint, quiz engine, study plans |
| 14 | **Practical Exercises & Mini Projects** | [14-Practical-Exercises-and-Mini-Projects.md](./developer%20Roadmap/14-Practical-Exercises-and-Mini-Projects.md) | 33 exercises, 10 mini projects, 1 capstone |
| 15 | **Answers & Results** | [15-Answers-and-Results.md](./developer%20Roadmap/15-Answers-and-Results.md) | Complete solutions, test classes, expected output |

Each guide follows the same structure: **core concepts → hands-on labs → practice quiz → SOQL/Apex practice** to build skills incrementally.

---

## ✨ What's Inside

### 🧠 Apex: 10 Service Classes + 11 Test Classes (100% commented for learning)

Every Apex file is documented with **learning-focused comments** explaining *why* the pattern is used (governors, bulkification, sharing, `AggregateResult`, `@TestSetup`, retries, recursion guards...).

| Service Class | Responsibility | Test Class |
|---------------|----------------|------------|
| `SoqlSoslService` | SOQL/SOSL, dynamic query, aggregates | `SoqlSoslServiceTest` |
| `TriggerHandlerService` | Trigger framework + recursion guards | `TriggerHandlerServiceTest` |
| `PerformanceService` | Bulk-safe normalization, health scores | `PerformanceServiceTest` |
| `AsyncJobService` | Queueable / batch / scheduled job monitor | `AsyncJobServiceTest` |
| `EventPublisherService` | Platform event publishing + subscribers | `EventPublisherServiceTest` |
| `SecurityService` | Sharing, field-level security, strip-TO-save | `SecurityServiceTest` |
| `IntegrationService` | Outbound callouts, retries, correlation ids | `IntegrationServiceTest` |
| `LwcDataService` | LWC wire/action controller endpoints | `LwcDataServiceTest` |
| `InboundRestService` | Inbound REST endpoints + audit logging | `InboundRestServiceTest` |
| `CertificationPrepService` | Question bank, study plans, quiz engine | `CertificationPrepServiceTest` |

Plus `DeveloperFundamentalsTest` covering Phase 1 core CRUD and SOQL.

### ⚡ Triggers (7)

`AccountTrigger`, `AsyncJobMonitorTrigger`, `CodeReviewTrigger`, `IntegrationLogTrigger`, `IntegrationEventSubscriberTrigger`, `StudyPlanTrigger`, `TrainingQuestionTrigger` — each delegating work to its service class (trigger-light / logic-in-service best practice) and using a shared suppression framework to stay re-entrant-safe.

### ⚙️ Metadata

- **5 custom objects**: `Async_Job_Monitor__c`, `Integration_Log__c`, `Code_Review__c`, `Training_Question__c`, `Study_Plan__c`
- **166+ object/field metadata files** — custom fields across `Account`, `Contact`, `Lead`, `Opportunity`, `Case`, `Task`, `Event`, `Campaign`, `User`
- **6 Flows** (study-plan auto-init, task priority defaults, inbound log flagging, job retry scheduler, question activation, study completion)
- **5 validation rules** (dates, score bounds, answers, durations)
- **1 approval process** for code reviews
- **Assignment rules** (Lead + Case routing)
- **1 permission set** `Salesforce_Developer`
- **1 platform event** `Integration_Event__e`
- **1 dashboard + 2 reports**
- **1 custom metadata type** `Certification_Setting__mdt` (real PDI / PDII exam facts)

> **Learning note**: Flows / Reports / Dashboards exist as **simplified reference metadata**. Best practice is to re-create them in the Flow Builder / Report Builder UI (the guides in `developer Roadmap/` walk through every click).

### 📜 Practice Scripts

Build queries and Apex warming-up snippets progressively in [`scripts/`](./scripts). Run them with:

```bash
sf apex run --apex-code-file scripts/soql/account.soql --target-org myDevOrg
```

---

## 🚀 Quick Start

### 1. Prerequisites

- **Salesforce CLI** — [install guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm)
- **VS Code + Salesforce Extension Pack** — [install guide](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide/install.html)
- A free **Developer Edition org** — [sign up](https://developer.salesforce.com/signup)

### 2. Authenticate an org

```bash
sf org login web --alias myDevOrg
```

### 3. Deploy all metadata

```bash
sf project deploy start --source-dir force-app/main/default --target-org myDevOrg --wait 15
```

Or deploy in **phases** as you study (example — Phase 5 only):

```bash
sf project deploy start \
  --metadata ApexClass:EventPublisherService,IntegrationService,ApexTrigger:IntegrationLogTrigger \
  --target-org myDevOrg --wait 15
```

### 3b. (Optional) Scratch org workflow

```bash
sf org create scratch -f config/project-scratch-def.json --alias scratch-org --set-default
```

### 4. Run the tests

```bash
sf apex run test --target-org myDevOrg --test-level RunLocalTests --wait 15
# or a single class
sf apex run test --class-names SecurityServiceTest --target-org myDevOrg --wait 15
```

All test classes use `@TestSetup` + `@isTest` and assert real behaviour (including managed sharing round-trips and `HttpCalloutMock` flows) — a great model for 75% coverage requirements and quality test-writing.

---

## 📂 Project Structure

```
.
├── force-app/main/default/
│   ├── classes/            # 21 commented Apex classes (service + test)
│   ├── triggers/           # 7 triggers delegating to services
│   ├── objects/            # Custom objects + custom fields + validation rules
│   ├── flows/              # 6 flows (reference metadata)
│   ├── approvalProcesses/  # Code review approval process
│   ├── assignmentRules/    # Lead + Case queue routing
│   ├── permissionsets/     # Salesforce_Developer
│   ├── reports/            # 2 reports (reference metadata)
│   ├── dashboards/         # 1 dashboard (reference metadata)
│   ├── platformEvents/     # Integration_Event__e
│   └── customMetadata/     # Certification_Setting__mdt (exam facts)
├── developer Roadmap/      # 15 phase study guides (13 theory + exercises + answers)
├── scripts/apex/           # Apex warming-up snippets
├── scripts/soql/           # Practice SOQL queries
├── config/                 # Scratch org definition
├── manifest/               # package.xml
├── docs/                   # Interactive study site (GitHub Pages)
├── sfdx-project.json       # Project config (API 68.0)
└── README.md
```

---

## 🎓 Certification Path

Phase 13 bundles everything into certification prep for:

- **Platform Developer I** — 60 questions, 68% passing score, 105 minutes, $200, no prerequisite
- **Platform Developer II** — 60 questions, 65% passing score, 105 minutes, $200, requires PDI (Superbadges were retired as a requirement in October 2025)

Use `Certification_Setting__mdt` for the facts, `Training_Question__c` as a mini question bank, and `CertificationPrepService` as a quiz + study-plan engine to build your own practice exams.

---

## 📚 Additional Resources

- [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/)
- [Salesforce Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/)
- [Salesforce Flow Documentation](https://help.salesforce.com/s/articleView?id=sf.flow.htm&type=5)
- [Trailhead: Platform Developer](https://trailhead.salesforce.com/)

---

## 🤝 Contributing

Found a bug, improved a comment, or added a phase exercise? PRs are welcome. Please keep the **learning-first** spirit: explain *why*, keep the metadata deployable, and add a test when you add logic.

## 📝 License

This project is for **learning and educational purposes**. Free to use, fork, and adapt.