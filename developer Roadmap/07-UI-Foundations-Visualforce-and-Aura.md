# Phase 7: UI Foundations — Visualforce and Aura

Half of the Platform Developer I exam weight hides in UI. This phase covers the two server-ish UI technologies—Visualforce pages and the Aura framework—plus the Apex controllers both rely on. Lightning Web Components get their own phase (8), but the certification expects you to recognise and maintain all three.

## Learning Objectives

By the end of this phase, you will be able to:
- Build a Visualforce page with a custom controller and a standard controller extension.
- Explain Visualforce server-side View State and when rerender/actionFunction improve it.
- Structure an Aura component with attributes and handlers.
- Distinguish component, application, and broadcast events in Aura.
- Write `@AuraEnabled` controllers for Aura (and reuse them for LWC).
- Queue client-side actions with `$A.enqueueAction`.

## 1. Visualforce: Pages and Controllers

**Visualforce** is a tag-based server-side framework: an `apex:page` holds markup, server-side controllers provide data, and the page's **View State** keeps component state across postbacks.

The minimal page:

```xml
<apex:page controller="AccountController">
    <apex:form>
        <apex:inputText value="{!searchTerm}" />
        <apex:commandButton value="Search" action="{!search}" reRender="results" />
        <apex:pageBlock id="results">
            <apex:pageBlockTable value="{!accounts}" var="acc">
                <apex:column value="{!acc.Name}" />
                <apex:column value="{!acc.Industry}" />
            </apex:pageBlockTable>
        </apex:pageBlock>
    </apex:form>
</apex:page>
```

Controller side (custom controller):

```apex
public with sharing class AccountController {
    public String searchTerm { get; set; }
    public List<Account> accounts { get; set; }

    public PageReference search() {
        accounts = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Name LIKE :('%' + searchTerm + '%')
            LIMIT 50
        ];
        return null;
    }
}
```

The exam's Visualforce surface area:

- **Standard controller** — `controller="Account"` gives the page the standard {!view}, {!save}, {!edit} and the single record via `{!Account}` without writing a class. Restricted to one record, no custom logic.
- **Controller extension** — `extensions="..."` — a custom class whose constructor takes `ApexPages.StandardController`:

```apex
public class AccountExtension {
    private final ApexPages.StandardController ctrl;
    public AccountExtension(ApexPages.StandardController ctrl) {
        this.ctrl = ctrl;
    }
    public PageReference stampPriority() {
        // set fields on ctrl.getRecord() and record e.g. on Opportunity
        return null;
    }
}
```

- **Actions and re-renders**: `action="{!method}"` runs server-side on submit; `reRender="id"` performs a partial page (Ajax) round trip — less View State, snappier UI. `apex:actionFunction` calls a controller method from JavaScript without a full form postback.
- **View State**: the serialized state of the controller and component tree sent to the browser each postback. Bloat grows it; **transient** methods/fields and `apex:outputPanel` re-renders trim it. The 290 KB default commit limit is the classic `ViewStateException` trap.
- `apex:pageBlock`, `apex:pageBlockSection`, `apex:pageBlockTable` define the standard form layout. `apex:pageMessages` displays errors/confirmations. `apex:outputText value="{!Account.Health_Score__c}"` renders values; `apex:inputField value="{!...}"` renders editable typed fields.
- Data binding runs **server-side**; every change the user makes round-trips through the page's controller on the next action.

## 2. Aura: The Lightning Component Framework

**Aura** ("Lightning") is the client-server framework behind Lightning Experience's classic components. Components are bundles: `.cmp` (markup), `.js` (client controller), `.css`, `.auradoc`, `.design`, `.svg`. Notable features for the exam: server round trips via `@AuraEnabled` Apex, **view state replaced by better hand-offs**, and no full page refresh.

A minimal component:

```xml
<aura:component>
    <aura:attribute name="accounts" type="Account[]" />
    <aura:handler name="init" value="{!this}" action="{!c.doInit}" />
    <ul>
        <aura:iteration items="{!v.accounts}" var="acc">
            <li>{!acc.Name}</li>
        </aura:iteration>
    </ul>
</aura:component>
```

Client controller:

```js
({
    doInit: function (component, event, helper) {
        let action = component.get('c.getAccountsWithContacts');
        action.setCallback(this, function (response) {
            if (response.getState() === 'SUCCESS') {
                component.set('v.accounts', response.getReturnValue());
            }
        });
        $A.enqueueAction(action);    // dequeues server actions in order
    }
})
```

Key Aura mechanics to internalise:

- `$A.enqueueAction(action)` queues the server round trip; callbacks inspect `response.getState()` ('SUCCESS' | 'ERROR' | 'INCOMPLETE').
- `@AuraEnabled` Apex is the server bridge; **`@AuraEnabled(cacheable=true)`** methods may be called by `$A.util.getDataService`-style caches and cannot contain DML (see Phase 8 — same annotations power LWC wire).
- Attributes are declared and referenced as `{!v.myAttribute}`; component methods `{!c.method}`, `{!c.mymethod}`, `{!helper.method}`.
- Aura components compile down to a server-side "view state-free" model but still keep **context/reference data per tab**; keep payloads small.

## 3. Aura Events: Component vs Application vs Broadcast

Events in Aura come in three flavours — an exam favourite because they're conceptually different:

| Type | Scope | How fired / heard |
|------|-------|-------------------|
| **Component event** | Component tree / containment hierarchy | `aura:registerEvent type="c:MyCompEvent"`; fired with `$A.get("e.c:MyCompEvent")` (or `event.getSource()` reference); handlers declare `aura:handler event` and can bubble/compose through the ancestor chain. |
| **Application event** | Entire application | `aura:registerEvent type="c:MyAppEvent"` on the component; fired with `$A.get("e.c:MyAppEvent")` and received by any component registered for it across the whole app. Best for loosely coupled, cross-container communication. |
| **Broadcast event** | Global, one-to-many system notification | Fired like an application event for system-wide notices; components don't encumber wired tree paths. (Conceptually "broadcast to everyone"). |

Practical selection: use **component events** when the parent-item relationship matters (the classic nested-iteration "select this item" case); use **application events** to tell independent tabbed/docked components of a change (e.g., an update elsewhere invalidating a cached section); reserve broadcast events for model-less, fire-and-forget notices. The exam pairs each scenario with the correct event type, and the trick pair is "which event reaches a component that is *not* in the same tree path" → application/broadcast, not component.

## 4. Controllers Behind the UI: @AuraEnabled and @AuraEnabled(cacheable)

The Apex side of any Lightning UI lives in this repo's `LwcDataService.cls` — the exact same signatures serve Aura components:

```apex
@AuraEnabled(cacheable=true)
public static List<Account> getAccountsWithContacts() {
    if (!Schema.SObjectType.Account.isAccessible()) {
        return new List<Account>();
    }
    return [
        SELECT Id, Name, Health_Score__c, Industry,
               (SELECT Id, Name FROM Contacts ORDER BY Name LIMIT 3)
        FROM Account
        ORDER BY Name LIMIT 20
    ];
}
```

Certification-grade controller rules:

- `@AuraEnabled` methods are **`public static`** (no Aura instance); annotated methods may be called by Lightning clients. REST-style `global` is not required unless packaged.
- **A method used with `@wire`/cached calls must be `@AuraEnabled(cacheable=true)`** and must **not perform DML or be non-deterministic** (no side-effecting writes; `System.now()` in a cached method is also suspect).
- Non-cacheable `@AuraEnabled` methods may perform DML and are the imperative "command" path (`recordStudyProgress` in the repo updates and returns state in one round trip).
- Return values must be JSON-serialisable: primitives, lists, maps, and sObjects. Inner classes/DTOs are serialised fine; **no arbitrary Java objects**.
- `AuraHandledException` is the correct typed error to throw so failures surface as user-safe messages in Lightning.
- **Only `AuraEnabled` methods are callable** — every helper must be `@AuraEnabled` to be reachable from the client, which is why the `getX`/`helper` pattern separates logic while exposing only the endpoints.

## 5. Comparing the Two Worlds

| Dimension | Visualforce | Aura |
|-----------|-------------|------|
| Execution | server-side page + postbacks | client-server; AJAX round trips |
| Data binding | `{!controller.property}` | `{!v.attribute}` with client controller |
| Controller | custom class or standard controller + extension | `@AuraEnabled` static Apex methods |
| Server round trip | every submit (View State) | on-demand `$A.enqueueAction` calls |
| Component model | `apex:component/s` | `aura:component` bundles |
| Coccesioning | page-level | component-level, re-usable |
| When to use | classic/legacy pages, printable pages | Lightning Experience components |

Both still appear on PDI; LWC (Phase 8) is the current-exam headline significantly, but Phase 8 also notes the overlap: **`@AuraEnabled` serves both Aura and LWC identically.**

## 6. Visualforce Component Cheat Sheet

| Tag | Purpose |
|-----|---------|
| `apex:page` | Root element; declares `controller` and `extensions` |
| `apex:form` | Required parent for postback input/actions |
| `apex:inputText` / `apex:inputField` | Editable input; `inputField` renders the *typed* control from the field's describe |
| `apex:commandButton` / `apex:commandLink` | Submits an `action` (postback) |
| `apex:outputText` / `apex:outputPanel` | Renders values; `outputPanel` groups for reRender |
| `apex:pageBlock` / `apex:pageBlockSection` | Standard-form layout |
| `apex:pageBlockTable` | Tabular data with `value`/`var` |
| `apex:pageMessages` | Displays controller `ApexPages.addMessage` |
| `apex:actionFunction` | JS-callable controller action without an explicit postback |
| `apex:actionRegion` | Limits which inputs post back on an action |
| `apex:component` | Custom re-usable VF component bundle |

### View State, Again

View State = the server-serialized controller + component tree delivered with the page. Every `commandButton` postback sends it up and gets it back. Bloat triggers the **`ViewStateException`** at the ~290 KB default limit. The three canonical reducers the exam asks about by name:

- **`transient`** — fields don't serialize (instantiate lazily in `get`): `public transient List<X> cache { get { if (cache == null) cache = new ...; return cache; } }`.
- **Ajax `reRender`** with `apex:actionFunction` — only the rerendered region returns, not the whole page.
- **`apex:outputPanel`** scoping — narrow what a partial round trip refreshes.

## 7. Aura Client Controller and Lifecycle Intricacies

Beyond the basic pattern, the exam probes finer points:

- **`init`/`change`/`load` handlers** — `aura:handler name="init"` runs on creation; `name="change" value="{!v.x}"` reacts to attribute changes; `name="load"` on a `lightning:appShell`'s callback.
- **`$A.getCallback` / `$A.util`** — wrap asynchronous JS work: `$A.getCallback(() => { ... })`; `$A.util.hasClass`, `.toggleClass`, `.isEmpty`.
- **Callback states** — `SUCCESS`, `ERROR`, `INCOMPLETE`; a callout answer of `INCOMPLETE` means the plateau retried; retries are not automatic.
- **`component.set('v.attr', ...)` / `component.get`** — read/write attributes; changes trigger dependent `change` handlers.
- **Helper layer** — keep heavy logic in the helper; controllers stay thin (the `action.setCallback` wrapper is the norm).
- **Server round trips** are keyed by *action name*, not payload — so identical actions to the same server method share *caching* behavior only when marked `@AuraEnabled(cacheable=true)`.

## 8. Server Access from Aura: The Two-Contract View

Put the two sides together. Aura components and LWC call the **same** `@AuraEnabled` surface:

| Aspect | `@AuraEnabled` (imperative) | `@AuraEnabled(cacheable=true)` |
|--------|----------------------------|-------------------------------|
| Apex method is `public static` | yes | yes |
| DML allowed | yes | **no** |
| Called from client how | `$A.enqueueAction` (Aura) or imperative import (LWC) | `@wire` (LWC) / cached `$A.enqueueAction` |
| Return value | serializable | serializable (and cacheable, so deterministic) |
| `AuraHandledException` | surfaces as `ERROR` state | surfaces as `ERROR` state |

You can expect a question that shows a `cacheable=true` method performing `insert` and asks "what happens" — the correct answer is always **the method fails at runtime with a platform error** (cacheable methods may not perform DML). That single fact is one of the most reliable "guaranteed points" on both developer exams.

## Hands-On Exercises

### Exercise 1: Visualforce custom controller

1. Create `AccountController.cls` with `searchTerm` + `accounts` as in Section 1.
2. Build `AccountSearch.page` with `apex:page controller="AccountController"`, an input, a command button (`reRender="tableId"`), and a `pageBlockTable`.
3. Deploy, open in the browser, search a term, then add `apex:pageMessages` and test a `QueryException` scenario (bad field).

### Exercise 2: Standard controller + extension

1. Create `AccountExtension.cls` with the `ApexPages.StandardController` constructor shown above; add a `priorityFlags` action setting a custom field.
2. Create `AccountView.page` with `standardController="Account" extensions="AccountExtension"` referenced from a custom button on the record page.
3. Verify `{!Account.Name}` renders and the extension action fires on save.

### Exercise 3: Aura component + Apex endpoint

1. Deploy `LwcDataService` and create an Aura component `accountCtl` with an `init` handler calling `c.getAccountsWithContacts`.
2. Render the returned rows with `aura:iteration` in a list.
3. Add an application event (`aura:registerEvent` + `$A.get("e.c:AccountUpdated")`) that a second component listens for via `<aura:handler event="c:AccountUpdated" action="{!c.refresh}"/>` — then fire it and observe cross-component refreshes.

### Exercise 4: Event scope lab

1. Build a parent component with a child; child fires a component event (`component.set("v.message", ...)` pattern + `event.fire()`), assert the parent's `aura:handler` catches it.
2. Add a second, *unrelated* component and repeat with an application event — prove it receives the message where the component event could not.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Visualforce** | Tag-based server-side markup framework (`apex:page`, `apex:form`, `apex:commandButton`). |
| **Standard controller** | Controller tied to one record of an object; provides `{!save}`, `{!edit}`, list rendering. |
| **Controller extension** | Class taking `ApexPages.StandardController`; adds methods/actions to a standard controller. |
| **View State** | Server-serialized component/controller state posted with each request; ~290 KB commit limit. |
| **reRender / actionFunction** | Partial-page Ajax mechanics that reduce round-trip payloads. |
| **Aura** | Client-server Lightning Component framework (`aura:component`, attributes, handlers). |
| **`$A.enqueueAction`** | Queues a client-side action to the server; preserves call order. |
| **Component event** | Aura event scoped to the component containment hierarchy. |
| **Application event** | Aura event broadcast to all registered components app-wide. |
| **Broadcast event** | Aura event for global, decoupled system notifications. |
| **`@AuraEnabled`** | Marks a `public static` Apex method callable from Lightning (cached vs command). |
| **`AuraHandledException`** | Typed exception whose message surfaces safely to Lightning users. |

## Certification Checkpoints

- [ ] I can write a Visualforce page that searches Account records via a custom controller.
- [ ] I know the exact constructor contract of a controller extension.
- [ ] I can explain View State and two techniques to reduce it.
- [ ] I can contrast component vs application vs broadcast events with one scenario each.
- [ ] I can write `@AuraEnabled(cacheable=true)` vs imperative `@AuraEnabled` callable paths.
- [ ] I can state which Apex methods are visible to Lightning (only `@AuraEnabled`) and their static requirement.
- [ ] I understand Aura's `$A.enqueueAction` ordering and response-state checking.