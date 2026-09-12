# Phase 11: Integration and Enterprise Patterns

Integration is the PDII's 27% shared backbone: how Apex leaves the org (callouts, named credentials), how the org opens its doors (REST resources), and how events stitch it all together. Every pattern in this phase has a concrete implementation in the repo—read the code, not just these notes.

## Learning Objectives

By the end of this phase, you will be able to:
- Configure and use Named Credentials with `callout:NCName/path` endpoints.
- Perform outbound HTTP with correct methods, headers, timeouts, and status handling.
- Enforce the 10-callout synchronous limit cleanly.
- Authenticate externally with OAuth 2.0 flows (client credentials recognizing org-based principals).
- Expose inbound REST APIs with `@RestResource` + `global` methods.
- Use platform events as a decoupled integration bus and audit every attempt in `Integration_Log__c`.
- Choose the right API for the job: SOAP/outbound messaging, REST, Bulk API 2.0, Composite, Composite Graph, Graph API.

## 1. Outbound Callouts and Named Credentials

**Named Credentials** live in Setup → Security → Named Credentials. They store the base URL, authentication method, and credentials securely, and your Apex references them by name — **credentials never appear in source**:

```apex
public static final String NAMED_CRED_REF = 'callout:Dev_API_Endpoint';
HttpRequest request = new HttpRequest();
request.setEndpoint(NAMED_CRED_REF + '/health');      // HTTPS only when using NC
request.setMethod('GET');
request.setHeader('Content-Type', 'application/json');
request.setTimeout(10000);                             // ms; default 120 s
```

Why they matter on the exam: with a Named Credential you (a) never hardcode secrets, (b) choose **`Principal = "Named Principal"`** so the call runs with the credential's fixed identity rather than per-user OAuth, and (c) can apply **Callout Options** — including `Allow Merge Fields in Body` and per-credential `Certificate`. A raw URL (`https://`) is also legal, but then auth and secrets stay in code — the anti-pattern.

### The Callout Lifecycle

1. Build `HttpRequest`: endpoint (NC or full URL), method, `setHeader`, `setBody`, `setTimeout`.
2. `Http http = new Http();`
3. `HttpResponse response = http.send(request);` forces a full synchronous round trip.
4. Read `getStatusCode()`, `getBody()`, `getHeader()`.
5. Handle failure: `CalloutException` on network errors, non-2xx on business errors.

The repo's `IntegrationService.callOutbound` shows the disciplined variant — it *checks the governor first*:

```apex
if (Limits.getCallouts() >= Limits.getLimitCallouts()) {
    throw new CalloutLimitExceededException('Synchronous callout limit reached');
}
```

then sends, retries 5xx once (transient server failures are a classic enterprise pattern), and **logs every attempt** to `Integration_Log__c` with a correlation id. The callout-based limits you must quote: **10 callouts per synchronous transaction** (реthe 10-Callout rule); each request may set a timeout between its default (120 s) and a tuned lower value.

## 2. Timeouts, Retries, and HTTP Status Semantics

- `request.setTimeout(ms)` — 120,000 ms max; 10,000 ms is a sane endpoint baseline (repo constant `DEFAULT_TIMEOUT_MS`).
- 2xx = success; 3xx = redirect (follow or set `setCompressed`? — follow manually); 4xx = caller error (do NOT retry blindly); 5xx = transient server error (retry with exponential backoff).
- Retry policy: the repo retries a 5xx exactly once (`attempts == 1 ? 502 : 200` in the mock) and records `Retry_Count__c` on the audit row for observability.
- Correlation ids (`generateCorrelationId`): a stable, random string per logical attempt so logs, dashboards, and external systems can join the story across retries — `IntegrationServiceTest.correlationIdIsStableAcrossRetries` covers it.

## 3. External Authentication and OAuth 2.0

Enterprise systems rarely accept naked URLs. The standard patterns:

- **OAuth 2.0 client credentials** — an external service provider grants the org its own client credentials; the org calls the provider's token endpoint to get an access token, then attaches `Authorization: Bearer <token>`. With Named Credentials this is configured as an **outbound OAuth 2.0** principal (grant type per the provider), and Apex just references `callout:Name/path` — the platform handles token refresh.
- **Username-password / basic** and **JWT bearer** variants exist for providers that support them; per-credential **certificate + private key** attachments carry the org's identity for mTLS-style integrations.
- **Callout Options**: `Allow Merge Fields in Body` lets you inject merge fields resolved from the current user into the request (e.g. `{!$Credential.Username}`) without publishing raw secrets.

The exam's favourite trap: **don't put tokens in query strings or headers in code**; use Named Credentials so the platform manages expiry/refresh, and keep secrets out of git (`.forceignore` excludes `*.credentials`? — no: the point is you never *have* credentials files in source at all).

## 4. Inbound REST APIs

Expose internal logic to the outside world with `@RestResource`:

```apex
@RestResource(urlMapping='/DevRoadmap/v1/logs/*')
global with sharing class InboundRestService {

    @HttpGet
    global static void doGet() {
        RestRequest request = RestContext.request;
        RestResponse response = RestContext.response;
        List<Integration_Log__c> logs = fetchRecentLogs(limitRows);
        response.statusCode = 200;
        response.addHeader('Content-Type', 'application/json');
        response.responseBody = Blob.valueOf(JSON.serialize(logs));
    }

    @HttpPost
    global static void doPost(Integration_Log__c incoming) {
        // validate, enforce direction, create, return 201 + Id
    }

    @HttpDelete
    global static void doDelete() {
        // parse the trailing Id from requestURI, delete, 200
    }
}
```

The contract, exactly as the exam draws it:

- **`RestContext.request`/`response`** carry the in-flight request/response in memory.
- **`global` on the class and every method**; methods are **static**; wrong modifiers = compile error.
- Verbs: `@HttpGet`/`@HttpPost`/`@HttpPatch`/`@HttpPut`/`@HttpDelete`, plus `HTTPDELETE`, `HTTPPATCH`, `HTTPPUT`.
- URL mounts at `/services/apexrest/<urlMapping>`; wildcard subpaths land in `requestURI`.
- **Security trade-offs**: this repo deliberately chooses `without sharing` semantics discussion in `InboundRestService` docs — the service class is `with sharing`, runs as the calling user, and *still* enforces CRUD/FLS explicitly (`Schema.SObjectType.Integration_Log__c.isCreateable()`), exactly Postman-to-apexrest-hardened style. For an endpoint acting on behalf of ordinary users you would enforce sharing per-record.
- **Unit-test seam**: pure helpers (`fetchRecentLogs`, `createIntegrationLog`, `deleteIntegrationLog`) avoid touching `RestContext` so tests cover the logic directly (`InboundRestServiceTest`), leaving HTTP-status plumbing to the thin wrapper.

## 5. Platform Events as the Integration Bus

Beyond triggers (Phase 5), events earn their keep in integration:

- **Publish from Apex** (`EventBus.publish(list)`), from flows, from Apex triggers after DML, and even from **Process Builder/Flow** — but the elegant contract is: *your integration layer writes an audit row (`Integration_Log__c`) and a trigger/after-mechanism turns it into an event*; subscribers (another trigger, a flow, an external CometD client) react.
- Inbound external feeds arrive via **CometD (streaming API)**, whose subscribers can **replay from a ReplayId** after disconnects (low-volume events: ~24 h retention; high-volume: ~72 h). Platform events *are* the durable, scalable version of what outbound messaging used to solve.
- The repo's loop is explicit: `IntegrationService.callOutbound` → insert `Integration_Log__c` → `IntegrationLogTrigger` (after insert) → `EventPublisherService.publishIntegrationEvents` → `IntegrationEventSubscriberTrigger` materialises `Integration_Log__c` rows for inbound → recursion guard in `TriggerHandlerService` stops the loop at the party line. Read that pipeline wiring twice; it *is* the integrated bus diagram.
- Failure behaviour: publishing can fail (quota, field errors) → inspect `SaveResult.isSuccess()` and surface; a low-volume publish delivers synchronously to subscribers in the same transaction.

## 6. The API Menu: Outbound Messaging, Bulk, Composite, Graph

| API | Best for | Facts the exam wants |
|-----|----------|----------------------|
| **SOAP API + outbound messaging** | legacy partner integrations, workflow/OM beginnings | outbound messaging is a *config* (Workflow → Outbound Message); payload XML; requires a named endpoint in the workflow's metadata |
| **REST API** | modern point reads/writes | `/services/data/v68.0/sobjects/...`; CRUD verbs; used by `InboundRestService`-style endpoints conceptually reversed |
| **Bulk API 2.0** | tens of thousands to millions of rows | asynchronous job + batches; up to 15k records per batch, 150k records per job (preview) — the definitive "load 10k rows" answer |
| **Composite API** | cut a multi-step round trip | **up to 25 subrequests**, references with `@{referenceId}`, optional all-or-nothing |
| **Composite Graph API** | related subrequests as a graph | all-or-nothing (or all-or-partial) across related requests; rollback on failure |
| **Graph API** | multi-object operations in one call | graph payloads of `nodes`/`edges`; newer, preview-class capability |

The bulk/flexible answer pair memorised: *"huge insert volume"* → **Bulk API 2.0**; *"one UI click should do N related things"* → **Composite API**; *"N related things must all commit or none"* → **Composite Graph API**. Platform events overlap in the *async* corner — but for row data, Bulk wins.

## 7. The Audit Trail That Sells Everything

Every integration attempt in this repo becomes an `Integration_Log__c` row: `Direction__c`, `Integration_Type__c`, `Status__c`, `Endpoint__c`, `Http_Method__c`, `Response_Code__c`, `Request_Body__c`, `Response_Body__c`, `Retry_Count__c`, `Correlation_Id__c`, `Succeeded__c`. From that single object you get reports, dashboards, and a debuggable history of both directions. The PDII exam rewards the *habit*: observability (correlation ids, log-throw-to-event pipelines) is the difference between "it worked in Postman" and "enterprise integration".

## Hands-On Exercises

### Exercise 1: Named Credential end to end

1. In Setup → Security → Named Credentials create `Dev_API_Endpoint` (URL `https://api.example.com`, dependent auth or no-identity for pass-through).
2. Update `IntegrationService.NAME_CRED_REF` if the name differs; deploy; call `callOutbound('GET', '/health', null)` from anonymous Apex behind a `Test.setMock(HttpCalloutMock.class, ...)`-recorded run.
3. Verify `Integration_Log__c` row captures `Endpoint__c` as `callout:Dev_API_Endpoint/health` and `Succeeded__c` boolean.

### Exercise 2: Rest in/out with tests

1. Hit `IntegrationService.callOutbound('POST', '/health', '{"v":1}')` behind a mock; assert `Retry_Count__c` honours the 5xx-then-200 story.
2. Call `InboundRestService.createIntegrationLog(new Integration_Log__c(...))` directly and assert a row lands with `Direction__c='Inbound'`.
3. Extend `InboundRestServiceTest` with a 403 path by mocking `Schema.SObjectType.Integration_Log__c` uncreatable (describe mocking) and assert the exception type.

### Exercise 3: Event-driven bus drill

1. Publish 5 events via `EventBus.publish` in one call; confirm 5 `Integration_Log__c` rows via the subscriber trigger.
2. Check `EventPublisherServiceTest.subscriberTriggerMaterializesIntegrationLogFromEvent` covers the same path with `Correlation_Id__c` seeds.
3. Inspect the recursion guard: publish → log → trigger-publish loop must terminate (assert fixed total rows after a second publish).

### Exercise 4: API-selection worksheet

1. For each scenario below, name the approach (REST, Composite, Composite Graph, Bulk 2.0, Platform Event, Outbound Messaging) and justify in 1 sentence: (a) insert 90k opportunities nightly; (b) update the same Account and insert its 3 contacts in one round trip; (c) close an Opportunity *and* its line items all-or-nothing; (d) notify an independent external system asynchronously about a record change.
2. Trade with your study partner and compare answers against the Section 6 table.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Named Credential** | Org-stored endpoint + auth definition referenced from Apex as `callout:Name/path`. |
| **Callout** | Synchronous outbound HTTP from Apex via `Http send`. |
| **Timeout** | Millisecond cap per callout (default ~120 s; tune per endpoint). |
| **Correlation Id** | Stable per-request identifier joining logs across retries. |
| **OAuth 2.0 client credentials** | Provider-issued client id/secret flow managed by the Named Credential's principal. |
| **`@RestResource`** | Annotation exposing a `global` class at `/services/apexrest/<mapping>`. |
| **`RestContext`** | In-memory `request`/`response` objects for an in-flight REST call. |
| **Platform event bus** | Decoupled publish/subscribe messaging layer (`Integration_Event__e`). |
| **Replay** | CometD capability to resume from an event's `ReplayId` after disconnects. |
| **Bulk API 2.0** | Asynchronous high-volume load/query API (15k records/batch, 150k/job). |
| **Composite API** | One HTTP round trip wrapping up to 25 subrequests with `@referenceId`s. |
| **Composite Graph API** | All-or-nothing (or partial) batch of related subrequests in a graph. |
| **Outbound messaging** | Legacy workflow-driven XML push to a configured external endpoint. |

## Certification Checkpoints

- [ ] I can configure a Named Credential and reference it from code without leaking secrets.
- [ ] I can write a full callout (build/send/parse/status-handle) and name the 10-callout rule.
- [ ] I can contrast OAuth 2.0 principal flows and where the certificate attachment fits.
- [ ] I can build an `@RestResource` endpoint with correct `global`/static/verb annotations.
- [ ] I can trace the repo's Integration_Log → event → subscriber pipeline and its recursion guard.
- [ ] I can map each "capacity" scenario to Bulk, Composite, Composite Graph, or platform events.
- [ ] I can justify `with vs without sharing` for an inbound REST service and show the CRUD re-check.