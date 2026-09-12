/*
 * ============================================================================
 * SecurityService
 * ============================================================================
 *
 * [LEARNING FOCUS: Phase 9 + Apex Security & Sharing]
 *
 * WHAT THIS CLASS DOES:
 * A working showcase of the platform security APIs every developer must know:
 *   1. CRUD describe checks (Schema.SObjectType.X.isAccessible etc.)
 *   2. Field-Level Security (FLS) checks via Schema.getGlobalDescribe()
 *   3. stripInaccessible -> filter a list of records to only visible fields
 *   4. Apex Managed Sharing on the custom Code_Review__c object
 *
 * WHY IT MATTERS:
 * Apex runs with the running user's record sharing BY DEFAULT ONLY if the
 * class is declared `with sharing`/`inherited sharing`. But SHARING is not
 * CREATE/READ/UPDATE/DELETE (CRUD) permission, and record-level access is
 * not FLS. A secure class checks all three layers instead of hoping.
 *
 * Apex MANAGED sharing gives us programmatic control of who can see records
 * on custom objects which use the `with sharing` model - a classic mechanism
 * for Judge-like decisions (share a review with a mentor). Managed sharing
 * requires `without sharing` OR an Aplicación-context with a sufficiently
 * privileged user, which is exactly why we pair the class with its own
 * describing comment: this is the PDII "sharing objects" exam objective.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * 1. Describe maps: Schema.SObjectType.Account.isAccessible() etc.
 * 2. Field-level checks before a query/update.
 * 3. Security.stripInaccessible(Security.AccessType.READABLE, records)
 *    returns a SObjectAccessDecision with only safe fields populated.
 * 4. Creating Code_Review__Share rows = Apex Managed Sharing.
 * ============================================================================
 */
public with sharing class SecurityService {

    /* ----------------------------------------------------------------------
     * assertCanAccess(SObjectType type, SecurityAccess)
     * ----------------------------------------------------------------------
     * Throws a descriptive exception if the running user lacks CRUD/FLS for
     * the object. Keeps controllers honest with one readable line.
     * ----------------------------------------------------------------------
     */
    public enum SecurityAccess { READ, CREATE, UPDATE, DELETE }

    public static void assertCanAccess(
        SObjectType type,
        SecurityAccess access
    ) {
        Schema.DescribeSObjectResult describe = type.getDescribe();
        Boolean ok;
        switch on access {
            when READ {
                ok = describe.isAccessible();
            }
            when CREATE {
                ok = describe.isCreateable();
            }
            when UPDATE {
                ok = describe.isUpdateable();
            }
            when DELETE {
                ok = describe.isDeletable();
            }
        }
        if (!ok) {
            throw new SecurityAccessDeniedException(
                'No ' + access.name() + ' permission on ' + describe.getName()
            );
        }
    }

    /* ----------------------------------------------------------------------
     * isFieldAccessible(SObjectField field)
     * ----------------------------------------------------------------------
     * FLS check for a single field (Schema describe is cached per tx).
     * ----------------------------------------------------------------------
     */
    public static Boolean isFieldAccessible(SObjectField field) {
        return field.getDescribe().isAccessible();
    }

    /* ----------------------------------------------------------------------
     * stripToReadable(List<SObject> records)
     * ----------------------------------------------------------------------
     * Returns only the fields visible to the running user, all FK-looking
     * values cleared. Demonstrates Security.stripInaccessible.
     * ----------------------------------------------------------------------
     */
    public static List<SObject> stripToReadable(List<SObject> records) {
        SObjectAccessDecision decision =
            Security.stripInaccessible(
                Security.AccessType.READABLE,
                records
            );
        return decision.getRecords();
    }

    /* ----------------------------------------------------------------------
     * shareCodeReview(Id reviewId, Id userId, String accessLevel)
     * ----------------------------------------------------------------------
     * APEX MANAGED SHARING: grants Read/Edit on a Code_Review__c record to a
     * specific User row. Only works for custom objects with OWD "Private" or
     * "Public Read Only". The inserted object is the *__Share row.
     * ----------------------------------------------------------------------
     */
    public static void shareCodeReview(
        Id reviewId,
        Id userId,
        String accessLevel
    ) {
        if (String.isBlank(accessLevel)) {
            accessLevel = 'Read';
        }
        // Managed sharing requires the credentials to CREATE the share row.
        if (!Schema.SObjectType.Code_Review__Share.isCreateable()) {
            throw new SecurityAccessDeniedException(
                'Cannot create managed sharing rows'
            );
        }
        Code_Review__Share share = new Code_Review__Share(
            ParentId = reviewId,
            UserOrGroupId = userId,
            AccessLevel = accessLevel == 'Edit' ? 'Edit' : 'Read',
            RowCause = Schema.Code_Review__Share.RowCause.Manual
        );
        insert share;
    }

    /* ----------------------------------------------------------------------
     * deleteShare(Id shareId)
     * ----------------------------------------------------------------------
     * Inverse of shareCodeReview; also exercises the DELETE describe check.
     * ----------------------------------------------------------------------
     */
    public static void deleteShare(Id shareId) {
        if (!Schema.SObjectType.Code_Review__Share.isDeletable()) {
            throw new SecurityAccessDeniedException(
                'Cannot delete managed sharing rows'
            );
        }
        delete new Code_Review__Share(Id = shareId);
    }

    /* custom exception keeps explainable errors flowing upward */
    public class SecurityAccessDeniedException extends Exception {
    }
}