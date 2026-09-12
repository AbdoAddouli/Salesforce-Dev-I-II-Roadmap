/*
 * ============================================================================
 * InboundRestService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 11 - Inbound REST API (@RestResource)]
 *
 * WHAT THIS CLASS DOES:
 * Exposes this lab as an inbound REST API. You can POST Integration_Log__c
 * rows from an external tool (Postman, curl, Salesforce Flow) and GET recent
 * logs. Because it uses the SAME audit object both directions, dashboards
 * built in Phase 10 can visualise inbound + outbound together.
 *
 * REST annotations used:
 *      @RestResource(urlMapping='/DevRoadmap/v1/logs/*')
 *      @HttpGet()  @HttpPost()  @HttpDelete()
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. RestContext provides request/response in-memory represent for each call
 *    - populate from RestContext.request, write via RestContext.response.
 *
 * 2. `global` modifier is REQUIRED on the class and methods so the endpoint
 *    can be invoked by external parties; `static` methods only.
 *
 * 3. JSON.deserialize/JSON.serialize round-trip for the payload.
 *
 * 4. Security-first: this class is `without sharing` BY DESIGN so that the
 *    API can create audit records the calling user might not otherwise see -
 *    BUT we still enforce CRUD via SecurityService. The trade-off is the
 *    classic reason the annotation `@AuraEnabled` + `without sharing` are
 *    taught together on the exam.
 *
 * 5. Proper HTTP status codes: 201 Created, 200 OK, 400 Bad Request,
 *    404 Not Found.
 * ============================================================================
 */
@RestResource(urlMapping='/DevRoadmap/v1/logs/*')
global with sharing class InboundRestService {

    /* ----------------------------------------------------------------------
     * doGet()
     * ----------------------------------------------------------------------
     * GET  /services/apexrest/DevRoadmap/v1/logs?limit=10
     * Returns the 10 most recent Integration_Log__c rows as JSON.
     * ----------------------------------------------------------------------
     */
    @HttpGet
    global static void doGet() {
        RestRequest request = RestContext.request;
        RestResponse response = RestContext.response;

        String lim = request.params.get('limit');
        Integer limitRows = String.isNumeric(lim) ? Integer.valueOf(lim) : 10;
        limitRows = Math.min(50, Math.max(1, limitRows));

        List<Integration_Log__c> logs = fetchRecentLogs(limitRows);

        response.statusCode = 200;
        response.addHeader('Content-Type', 'application/json');
        response.responseBody = Blob.valueOf(JSON.serialize(logs));
    }

    /* ----------------------------------------------------------------------
     * fetchRecentLogs(Integer limitRows)
     * ----------------------------------------------------------------------
     * PURE LOGIC (no RestContext) - exists so unit tests can exercise the
     * same code path the HTTP handler uses without an actual REST call.
     * ----------------------------------------------------------------------
     */
    global static List<Integration_Log__c> fetchRecentLogs(Integer limitRows) {
        if (!Schema.SObjectType.Integration_Log__c.isAccessible()) {
            return new List<Integration_Log__c>();
        }
        return [
            SELECT Id, Name, Direction__c, Integration_Type__c, Status__c,
                   Endpoint__c, Http_Method__c, Response_Code__c,
                   Correlation_Id__c, Succeeded__c
            FROM Integration_Log__c
            ORDER BY CreatedDate DESC
            LIMIT :limitRows
        ];
    }

    /* ----------------------------------------------------------------------
     * doPost(Integration_Log__c incoming)
     * ----------------------------------------------------------------------
     * POST  /services/apexrest/DevRoadmap/v1/logs
     * body: {"Direction__c":"Inbound","Integration_Type__c":"REST API",...}
     * Returns 201 with the created record's Id, or 400 if the payload was
     * malformed/blank.
     * ----------------------------------------------------------------------
     */
    @HttpPost
    global static void doPost(Integration_Log__c incoming) {
        RestResponse response = RestContext.response;

        Id createdId;
        try {
            createdId = createIntegrationLog(incoming);
        } catch (ValidationFailedException e) {
            response.statusCode = 400;
            response.responseBody = Blob.valueOf(
                '{"error":"' + e.getMessage() + '"}'
            );
            return;
        } catch (SecurityService.SecurityAccessDeniedException e) {
            response.statusCode = 403;
            return;
        }

        response.statusCode = 201;
        response.addHeader('Content-Type', 'application/json');
        response.responseBody = Blob.valueOf(
            '{"id":"' + String.valueOf(createdId) + '"}'
        );
    }

    /* ----------------------------------------------------------------------
     * createIntegrationLog(Integration_Log__c incoming)
     * ----------------------------------------------------------------------
     * PURE LOGIC (no RestContext): validates, marks as Inbound, inserts and
     * returns the Id. Unit-tested directly; called by doPost().
     * ----------------------------------------------------------------------
     */
    global static Id createIntegrationLog(Integration_Log__c incoming) {
        if (incoming == null ||
            String.isBlank(incoming.Integration_Type__c)) {
            throw new ValidationFailedException(
                'Integration_Type__c is required.'
            );
        }
        if (!Schema.SObjectType.Integration_Log__c.isCreateable()) {
            throw new SecurityService.SecurityAccessDeniedException(
                'No create permission on Integration_Log__c'
            );
        }
        incoming.Direction__c = 'Inbound';
        insert incoming;
        return incoming.Id;
    }

    /* ----------------------------------------------------------------------
     * doDelete()
     * ----------------------------------------------------------------------
     * DELETE /services/apexrest/DevRoadmap/v1/logs/{id}
     * Best-effort archiving demo: deletes only directly-accessible rows.
     * ----------------------------------------------------------------------
     */
    @HttpDelete
    global static void doDelete() {
        RestRequest request = RestContext.request;
        RestResponse response = RestContext.response;

        String rawId = request.requestURI.substring(
            request.requestURI.lastIndexOf('/') + 1
        );
        try {
            deleteIntegrationLog(rawId);
            response.statusCode = 200;
        } catch (Exception e) {
            response.statusCode = 400;
        }
    }

    /* ----------------------------------------------------------------------
     * deleteIntegrationLog(String rawId)
     * ----------------------------------------------------------------------
     * PURE LOGIC (no RestContext): parses the Id safely and deletes the row.
     * ----------------------------------------------------------------------
     */
    global static void deleteIntegrationLog(String rawId) {
        Id recId = Id.valueOf(rawId); // throws IllegalArgumentException on junk
        if (!Schema.SObjectType.Integration_Log__c.isDeletable()) {
            throw new SecurityService.SecurityAccessDeniedException(
                'No delete permission on Integration_Log__c'
            );
        }
        delete new Integration_Log__c(Id = recId);
    }

    public class ValidationFailedException extends Exception {
    }
}