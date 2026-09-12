# 🏗️ Developer I & II RoadMap — Architecture

This document is a visual walkthrough of the system built across the 13 phases. All diagrams are [Mermaid](https://mermaid.js.org) and render natively on GitHub.

---

## 1. High-Level Architecture (Layered)

The project follows a **layered architecture**: Lightning Experience on top, automation in the middle, an Apex service layer doing the business logic, and clean, normalized data underneath.

```mermaid
flowchart TB
    subgraph UI["PRESENTATION"]
        UX["Lightning Experience — Developer Roadmap App"]
        DSB["Reports (2) & Dashboard (1)"]
        QUIZ["Certification Prep — Question Bank UI"]
        LWC["LWC Data Service Endpoints"]
    end

    subgraph AUTOMATION["AUTOMATION LAYER"]
        F[Flows (6)<br/>plan init, priorities, inbound flags, retries, completion]
        VR[Validation Rules (5)<br/>date & score bounds, answer validation]
        AR[Assignment Rules<br/>Lead + Case routing]
        AP[Approval Process<br/>Code review sign-off]
    end

    subgraph APEX["APEX LAYER (business logic)"]
        TRIGGERS["7 Triggers<br/>Account, AsyncJobMonitor, CodeReview, IntegrationLog,<br/>IntegrationEventSubscriber, StudyPlan, TrainingQuestion"]
        SERVICES["10 Service Classes<br/>Soql/Sosl, TriggerHandler, Performance, AsyncJob,<br/>EventPublisher, Security, Integration, LwcData,<br/>InboundRest, CertificationPrep"]
        AI["Integration_Event__e<br/>Platform Event"]
        CMT["Certification_Setting__mdt<br/>Custom Metadata"]
    end

    subgraph DATA["DATA LAYER"]
        STD["Standard Objects<br/>Account, Contact, Lead, Opportunity, Case,<br/>Task, Event, Campaign, User"]
        CUSTOM["Custom Objects<br/>Async_Job_Monitor__c, Integration_Log__c,<br/>Code_Review__c, Training_Question__c, Study_Plan__c"]
    end

    UX --> F
    UX --> VR
    UX --> AR
    UX --> AP

    F --> SERVICES
    VR --> DATA
    AR --> DATA
    AP --> SERVICES

    UX --> TRIGGERS
    TRIGGERS --> SERVICES
    SERVICES --> DATA

    SERVICES --> AI
    AI --> CMT

    DSB --> SERVICES
    QUIZ --> SERVICES
    QUIZ --> CUSTOM
    LWC --> SERVICES

    DATA --> DSB
    DATA --> QUIZ
```

> **Architecture principles used throughout:**
> - **Trigger-light / Service-heavy**: triggers only detect events; all logic lives in testable service classes.
> - **Bulk-safe**: every trigger iterates `Trigger.new` lists, never `for` loops with per-record DML.
> - **`with sharing`**: services enforce the security model.
> - **Re-entrant-safe**: a shared suppression framework prevents recursion (`TriggerHandlerService.suppress/restore`).
> - **Test-isolated**: every service has a `@isTest` companion using `@TestSetup`.

---

## 2. Data Model

Salesforce standard objects + the custom objects and their relationships. Custom fields extend each standard object (e.g. `Health_Score__c` on Account).

```mermaid
erDiagram
    USER ||--o{ STUDY_PLAN__C : "owns (Learner__c)"
    USER ||--o{ CODE_REVIEW__C : "reviews"
    USER ||--o{ ASYNC_JOB_MONITOR__C : "runs"

    CODE_REVIEW__C }o--|| USER : "Reviewer__c"
    STUDY_PLAN__C }o--|| USER : "Learner__c"

    INTEGRATION_LOG__C }o--o| INTEGRATION_EVENT__E : "correlates to"

    TRAINING_QUESTION__C {
        string Question_Text__c
        string Answer_Option_A__c
        string Correct_Answer__c
        string Explanation__c
        string Exam_Domain__c
        number Blueprint_Weight__c
    }

    STUDY_PLAN__C {
        string Phase_Name__c
        number Phase_Number__c
        number Progress__c
        number Quiz_Score__c
        string Status__c
    }

    ASYNC_JOB_MONITOR__C {
        string Job_Type__c
        string Job_Status__c
        number Total_Batches__c
        number Failed_Records__c
    }
```

**Custom objects & their purpose:**

| Custom Object | Purpose | Used By |
|---------------|---------|---------|
| `Async_Job_Monitor__c` | Observability rows for each async job | `AsyncJobService` |
| `Integration_Log__c` | Audit trail for every inbound/outbound call | `IntegrationService`, `InboundRestService` |
| `Code_Review__c` | Code review tracking + approval | `EventPublisherService` |
| `Training_Question__c` | Mini question bank mapped to the blueprint | `CertificationPrepService` |
| `Study_Plan__c` | User study plans across the 13 phases | `CertificationPrepService` |
| `Integration_Event__e` (platform event) | Asynchronous integration notification | `EventPublisherService` |
| `Certification_Setting__mdt` (custom metadata) | Real PDI / PDII exam facts (config) | `CertificationPrepService` |

---

## 3. Trigger → Service Wiring

Every trigger delegates to exactly one service — no logic lives inside a trigger.

```mermaid
flowchart LR
    subgraph T["TRIGGERS (7)"]
        AT["AccountTrigger"] --> PS["PerformanceService"]
        AMT["AsyncJobMonitorTrigger"] --> AJS["AsyncJobService"]
        CRT["CodeReviewTrigger"] --> EPS["EventPublisherService"]
        ILT["IntegrationLogTrigger"] --> EPS
        SPT["StudyPlanTrigger"] --> CPS["CertificationPrepService"]
        TQT["TrainingQuestionTrigger"] --> CPS
        IEST["IntegrationEventSubscriberTrigger"] --> SUBS["Integration subscriber listeners"]
    end

    subgraph SUPPORT["INVOKED FROM TESTS, FLOWS & USERS"]
        SOS["SoqlSoslService"]
        THS["TriggerHandlerService"]
        SS["SecurityService"]
        LS["LwcDataService"]
        IRS["InboundRestService"]
    end

    THS -. suppression / guard .-> T
    PS --> DB
    AJS --> DB
    EPS --> DB
    CPS --> DB
    SOS --> DB
    SS --> DB
    LS --> DB
    IRS --> DB
    SUBS --> DB

    DB[("f(x) Salesforce Org Data")]
```

> **Note:** `TriggerHandlerService` is embedded in every trigger for `shouldRun` / `suppress` / `restore`. `SoqlSoslService`, `SecurityService`, `LwcDataService` and `InboundRestService` are invoked from tests, LWC clients, or the REST endpoint rather than object triggers.

---

## 4. End-to-End Developer Workflow

How a dev-tooling idea becomes a tested, released feature.

```mermaid
flowchart TD
    A[Story / exam topic] --> B[Extend the data model<br/>custom object + fields + validation rule]
    B --> C[Write Apex service<br/>commented, bulk-safe, with sharing]
    C --> D[Wire a thin trigger<br/>delegating to the service]
    D --> E[Write @isTest companion<br/>@TestSetup + behaviours]
    E --> F[Run local tests<br/>sf apex run test]
    F --> G{"Coverage + quality gate<br/>(75%+ per class)"}
    G -->|pass| H[Deploy<br/>sf project deploy start]
    G -->|fail| C
    H --> I[Async work?<br/>Queueable / Batchable / scheduled]
    I -->|yes| J[Async_Job_Monitor__c rows]
    H --> K[Events to notify?]
    K -->|yes| L[publish Integration_Event__e<br/>subscriber processes]
    J --> M[Integrated + performance-verified<br/>before CI release]
    L --> M
    M --> N[CI/CD pipeline<br/>scratch org + package.xml]
```

---

## 5. Integration Architecture (Phase 11)

```mermaid
flowchart LR
    EXT["External System<br/>(ERP, Webhook, REST API)"] -->|"HTTP"| WEB{"IntegrationService"}
    WEB -->|"serialize request/response"| LOG["Integration_Log__c<br/>audit trail + Correlation_Id__c"]
    WEB -->|"publish platform event"| PE["Integration_Event__e"]
    PE -->|"subscriber trigger"| SUB["Async processors"]
    EXT -->|"inbound REST"| INB["InboundRestService<br/>doPost / doGet"]
    INB --> LOG
    WEB -->|failure| RETRY{"Retry? (Retry_Count__c)"}
    RETRY -->|yes, under max| WEB
    RETRY -->|past max| ERR["Custom exception<br/>'Max retries exceeded'"]
```

---

## 6. Certification Prep Architecture (Phase 13)

```mermaid
flowchart LR
    QB[Training_Question__c<br/>question bank] --> SVC[CertificationPrepService]
    SVC --> SETTINGS[Certification_Setting__mdt<br/>exam facts: 60/105/68%·65%/$200]
    SVC --> FILTER[filter by Exam_Domain__c]
    SVC --> QUIZ[getQuestionsByCertification<br/>randomized set]
    SVC --> SCORE[scoreQuiz<br/>grade + explanation]
    SVC --> PLAN[buildStudyPlan<br/>Study_Plan__c across 13 phases]
    QUIZ --> UI[Quiz UI]
    PLAN --> UI2[Study dashboard]
```

---

## 7. Folder → Architectural Layer Mapping

| Roadmap folder | Layer |
|----------------|-------|
| `force-app/main/default/classes/` | Apex service + test classes |
| `force-app/main/default/triggers/` | Event detection (thin) |
| `force-app/main/default/flows/` | Declarative automation |
| `force-app/main/default/objects/` | Data model (fields, validation rules) |
| `force-app/main/default/approvalProcesses/` | Human-in-the-loop approvals |
| `force-app/main/default/assignmentRules/` | Routing (queues) |
| `force-app/main/default/reports/` + `dashboards/` | Analytics |
| `force-app/main/default/platformEvents/` + `customMetadata/` | Integration substrate |
| `force-app/main/default/permissionsets/` | Security / FLS |
| `developer Roadmap/` | Curriculum (13 phase guides) |
| `scripts/` | Practice queries + Apex snippets |
| `docs/` | Interactive study site (GitHub Pages) |