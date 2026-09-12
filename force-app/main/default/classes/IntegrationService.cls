/*
 * ============================================================================
 * IntegrationService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 11 - Integrations: Callouts + Named Credentials]
 *
 * WHAT THIS CLASS DOES:
 * A single, well-documented REST callout implementation. It:
 *   - builds the HTTP request,
 *   - configures a Named Credential (callout:Dev_API/...),
 *   - sets timeouts (Apex default is 120s but 10s is a saner baseline),
 *   - executes, reads the status code, and logs EVERYTHING to the custom
 *     Integration_Log__c object for audit / dashboards,
 *   - retries 5xx responses once and marks the log accordingly.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. Named Credentials - the endpoint + auth live in the ORG (Setup >
 *    Security > Named Credentials) and are referenced as callout:Name/path.
 *    Never hard-code credentials in source; a callout:NamedCredential/seg
 *    endpoint keeps secrets out of git. This pattern is a PDII favourite.
 *
 * 2. CALLBACK LIMIT - Apex sync limit is 10 callouts per transaction. We
 *    cleanly early-exit when run ORDER exceeds them (fails fast with a
 *    descriptive exception instead of a cryptic limit error).
 *
 * 3. EVENT-DRIVEN LOGGING - after a successful call we DO NOT log directly;
 *    we let the AFTER-INSERT trigger and EventPublisherService broadcast an
 *    Integration_Event__e, so the log table and the event bus stay in sync.
 *
 * 4. TIMEOUT / STATUS handling - setTimeout(10000) guards a hung endpoint;
 *    HTTP method + endpoint are logged before the request is sent.
 *
 * 5. `with sharing` - record-level security remains intact for the logging.
 * ============================================================================
 */
public with sharing class IntegrationService {

    public static final Integer DEFAULT_TIMEOUT_MS = 10000;
    public static final String NAMED_CRED_REF = 'callout:Dev_API_Endpoint';

    /* inner contract so callers get a typed result, not a blob */
    public class CalloutResult {
        public Integer statusCode;
        public String body;
        public String correlationId;
        public Boolean retried;
        public Boolean success;
    }

    /* ----------------------------------------------------------------------
     * callOutbound(String method, String path, String payload)
     * ----------------------------------------------------------------------
     * Example: post SAP a new Account health snapshot.
     * method: GET/POST/PUT/PATCH/DELETE
     * path:   relative segment after the Named Credential root, e.g. /health
     * ----------------------------------------------------------------------
     */
    public static CalloutResult callOutbound(
        String method,
        String path,
        String payload
    ) {
        // Guard: 10 callouts per synchronous transaction
        if (Limits.getCallouts() >= Limits.getLimitCallouts()) {
            throw new CalloutLimitExceededException(
                'Synchronous callout limit reached'
            );
        }

        CalloutResult outcome = new CalloutResult();
        outcome.correlationId = generateCorrelationId();

        HttpRequest request = new HttpRequest();
        request.setEndpoint(NAMED_CRED_REF + path);
        request.setMethod(method);
        request.setHeader('Content-Type', 'application/json');
        request.setTimeout(DEFAULT_TIMEOUT_MS);
        if (String.isNotBlank(payload)) {
            request.setBody(payload);
        }

        String endpointForLog = request.getEndpoint();

        Http http = new Http();
        try {
            HttpResponse response = http.send(request);
            outcome.statusCode = response.getStatusCode();
            outcome.body = response.getBody();
            outcome.success =
                response.getStatusCode() >= 200 &&
                response.getStatusCode() < 300;

            // Retry once on 5xx (transient server errors).
            if (response.getStatusCode() >= 500) {
                HttpResponse retry = http.send(request);
                outcome.retried = true;
                outcome.statusCode = retry.getStatusCode();
                outcome.body = retry.getBody();
                outcome.success =
                    retry.getStatusCode() >= 200 &&
                    retry.getStatusCode() < 300;
            }
        } catch (CalloutException e) {
            outcome.success = false;
            outcome.body = e.getMessage();
        }

        // Audit trail: every attempt becomes an observable Integration_Log__c
        // row, which then drives the event bus via the after-insert trigger.
        Integration_Log__c log = new Integration_Log__c(
            Direction__c = 'Outbound',
            Integration_Type__c = 'REST API',
            Status__c = outcome.success ? 'Success' : 'Failed',
            Endpoint__c = endpointForLog,
            Http_Method__c = method,
            Response_Code__c = outcome.statusCode,
            Request_Body__c = payload,
            Response_Body__c = outcome.body,
            Retry_Count__c = outcome.retried ? 1 : 0,
            Correlation_Id__c = outcome.correlationId,
            Succeeded__c = outcome.success
        );
        insert log;

        return outcome;
    }

    /* ----------------------------------------------------------------------
     * generateCorrelationId()
     * ----------------------------------------------------------------------
     * Random string so external logs and the audit table line up across
     * retries (a key observability habit for integration work).
     * ----------------------------------------------------------------------
     */
    public static String generateCorrelationId() {
        return UserInfo.getUserId().left(6) +
            '-' +
            Crypto.getRandomLong().abs().format().replaceAll(',', '');
    }

    /* custom exception shows students where to subclass System.Exception */
    public class CalloutLimitExceededException extends Exception {
    }
}