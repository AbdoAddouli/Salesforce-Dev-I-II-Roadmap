# Phase 8: Lightning Web Components

Lightning Web Components (LWC) is the modern UI framework and the exam's primary UI focus. A custom component uses standard HTML, JavaScript modules, and the platform's data services; it talks to Apex through the same `@AuraEnabled` contracts you already know from Aura—but with a much leaner model.

## Learning Objectives

By the end of this phase, you will be able to:
- Structure an LWC: HTML template, JavaScript module, CSS, and `.js-meta.xml`.
- Bind reactive data with decorators (`@api`, `@track`, `@wire`).
- Call Apex with the imperative path and the `@wire` path, and know the cacheable rules.
- Handle both `data` and `error` from a wired method.
- Recognise when an imperative call (which may DML) is required instead of a wire.
- Justify LWC's place in the curriculum: PDII covers LWC directly.

## 1. The LWC Model

An LWC is a **bundle** in `force-app/main/default/lwc/<component>/` with a strict file contract:

| File | Role |
|------|------|
| `.html` | The template: markup with `if:`/`for:` modifiers and `data-` bindings |
| `.js` | The JavaScript module (ES6+) exporting the class |
| `.css` | Scoped styles (shadow DOM) |
| `.js-meta.xml` | Component metadata: `apiVersion="68.0"`, `isExposed`, target contexts (records, apps) |

Template essentials:

```html
<template>
    <lightning-card title="Accounts" icon-name="standard:account">
        <template if:true={accounts}>
            <lightning-datatable
                data={accounts}
                columns={columns}
                key-field="Id">
            </lightning-datatable>
        </template>
        <template if:false={accounts}>
            <p>No accounts found.</p>
        </template>
    </lightning-card>
</template>
```

```js
import { LightningElement, track } from 'lwc';

export default class AccountList extends LightningElement {
    columns = [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Health', fieldName: 'Health_Score__c', type: 'number' }
    ];
    @track accounts;
    @api recordId;          // set by Salesforce when on a record page
}
```

What makes LWC distinct from Aura:

- **Native web platform**: compiled JavaScript, no server-side component tree, no aura-era "component registry" round trips.
- **Shadow DOM**: scoped styling (`:host` selectors), no global CSS leak, and (unlike Aura) no Locker wrapper — LWC uses native shadow DOM plus strict CSP.
- **Reactivity**: state changes re-render automatically. `@track` is only needed for objects/arrays you mutate deeply or arrays you reassign; primitive and top-level property changes react without it. In modern LWC you can simply declare class fields.
- **One-way data flow**: parent → child via `@api` properties; child → parent via **CustomEvent**s (`this.dispatchEvent(new CustomEvent('selected', { detail: id }))`) or via Published/Subscribe (Message Service).

## 2. Decorators: @api, @track, @wire

| Decorator | Purpose | Notes |
|-----------|---------|-------|
| `@api` | Expose a **public** property or method to parents and to the platform (e.g. `recordId`, `fields`) | Needed for attributes set from the outside |
| `@track` | Make a **private** property's changes reactive (nested object mutation / array reassignment) | Modern LWC auto-tracks simple assignments; keep `@track` for deep mutations |
| `@wire` | Declaratively invite data into a component via an adapter/service (Apex method or UI API) | Returns `{data, error}`; fires response success/error callbacks automatically |

Wired state arrives as an object with `data` and `error`:

```js
import { wire } from 'lwc';
import getAccounts from '@salesforce/apex/LwcDataService.getAccountsWithContacts';

export default class Widget extends LightningElement {
    @wire(getAccounts)
    wiredAccounts({ data, error }) {
        if (data) {
            this.accounts = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.accounts = undefined;
        }
    }
}
```

The reactive parameter form uses a `$`-prefixed property—when the parameter changes, the wire **re-invokes**:

```js
@api recordId;
@wire(getRecord, { recordId: '$recordId', fields: [...] })
wiredRecord({ data, error }) { /* ... */ }
```

## 3. The Two Apex Call Paths

LWC talks to server-side Apex first by importing the method:

```js
import getAccounts from '@salesforce/apex/LwcDataService.getAccountsWithContacts';
import recordStudyProgress from '@salesforce/apex/LwcDataService.recordStudyProgress';
```

### Path 1: `@wire` — declarative, cacheable, read-only

```js
@wire(getAccounts)
{ data, error } → accounts
```

Rules that decide when you *may* wire:

- The Apex method must be `@AuraEnabled(cacheable=true)`.
- **Cacheable methods may not perform DML.** The cacheable contract means "safe to cache result": no insert/update/delete/upsert, no non-deterministic calls.
- Wires re-fire on input changes and are automatically managed by the Lightning data service cache — repeated loads of the same data are cheap.
- If you need fresh data *on demand* (user clicks refresh), call the wired function again after invalidating the cache—or switch to imperative.

### Path 2: Imperative call — explicit, allowed to DML

```js
recordStudyProgress({ planId: this.planId, completedLessons: 12 })
    .then((updatedPlan) => { this.plan = updatedPlan; })
    .catch((error) => { this.error = error; });
```

The imperative path is just a **Promise-returning call** to the imported function. Because the server method here is *not* cacheable, it may execute DML. That is the split the UI exam keeps testing:

| | `@wire` | Imperative |
|---|---------|------------|
| Apex annotation | `cacheable=true` required | plain `@AuraEnabled` (or cacheable) |
| DML allowed in method | **no** | yes |
| Fires | when component initialises / inputs change | when you call it |
| Best for | initial loads, read-only data, declarative refresh on input change | user-triggered writes, commands, freshness-guaranteed reads |

`LwcDataService.cls` models both halves in one file: `getAccountsWithContacts()` and `getQuestionsByDomain(domain)` are `cacheable=true` (wire targets); `recordStudyProgress(planId, completedLessons)` is plain `@AuraEnabled` and updates + returns fresh state in one round trip (`LwcDataServiceTest.imperativeDmlWithoutCacheableUpdatesAndReturnsState` proves both the DML and the returned shape).

## 4. Reactive Properties, Getters, and UI API

LWC reactivity is built on top of JavaScript's evaluation model:

- **Tracked properties**: decorators on the component trigger re-render when they change.
- **Getters** are derived, read-only state:

```js
get progressLabel() {
    return `${this.percent}% complete`;
}
```

- The template reacts to getters exactly like properties: `{progressLabel}`.

The **UI API** (`lightning/uiRecordApi`, `lightning/uiObjectInfoApi`) is separate from Apex `@wire` and is how components read standard records without writing Apex:

```js
import { getRecord } from 'lightning/uiRecordApi';
import HEALTH_FIELD from '@salesforce/schema/Account.Health_Score__c';

@wire(getRecord, { recordId: '$recordId', fields: [HEALTH_FIELD] })
wiredAccount({ data, error }) { /* ... */ }
```

`@salesforce/schema` lets you import field and object tokens declaratively; `lightning/uiRecordApi` offers `getRecord`, `updateRecord`, `getFieldValue`, etc. `recordId` comes from `@api recordId` on a record page, or from navigation state elsewhere.

## 5. Practical LWC Considerations the Exam Expects

- **No `@AuraEnabled` calls in loops** on the same wire — wire is for single reads; batch patterns belong server-side.
- **Errors surface as `error` in the wire payload**, not thrown exceptions; always branch on `{data, error}`.
- **Custom events**: `this.dispatchEvent(new CustomEvent('change', { detail: { name, id } }))` + parent `<c-child onchange={handler}></c-child>` is the canonical parent-child contract.
- **Lightning Message Service** (LMS) is the app-wide channel for decoupled components to publish/subscribe (`MessageChannel` custom metadata type + `@salesforce/messageChannel`).
- **Cache invalidation**: call `refreshApex(previousResult)` after a mutate to force the wire's cache to re-fetch; a common PDII scenario.
- **`eslint` config in the repo** (`eslint.config.js`, `jest.config.js`) means LWC code should pass lint and be unit-testable with Jest (`sf force:lightning:lwc:test run`).

## 6. LWC in the PDII Curriculum

The Platform Developer II exam now tests **Lightning Web Components directly** (its UI domain makes up 20% of the exam): you are expected to interpret LWC templates, spot DML-in-cacheable violations, pick the correct wire vs imperative approach, and evaluate component code for correctness — not just Aura/Visualforce archaeology. That is precisely why this repo keeps its `LwcDataService` (server side) and its tests repository-ready even though the `lwc/` folder starts empty: build the component, wire it, test the Apex contract, and you have covered the PDII UI objective.

## 6. Component Lifecycle and Rendering Notes

LWC's lifecycle is simpler than Aura's, but the exam stages its hooks:

| Hook | When | Uses |
|------|------|------|
| `constructor()` | first instantiation | init fields; `this` usable; private property decl |
| `connectedCallback()` | attached to DOM | wire does not fire until here; subscription safe |
| `renderedCallback()` | after each render | post-render DOM operations (throttle it; it runs on every render) |
| `disconnectedCallback()` | removed from DOM | unsubscribe/pub-sub cleanup |
| `errorCallback(error, stack)` | nested component error | boundary error handling |

Rendering modifiers: modern templates use `if:true/if:false` (replaces `if:` on the same element), `for:each` with `:key` (mandatory for list diffs), and `slot`/`slotted` for composition. A common exam bug: `for:each` without `:key` is illegal; `key` must be unique per iteration.

Caveats worth official study hours:

- **`@track` on generated arrays inside render**: reassign the whole array (`this.items = [...this.items, x]`) or ensure the mutation path is tracked via getter/property — reassignment is the predictable path.
- **Strict CSP**: LWC runs under strict Content Security Policy; `eval`-looking machinery is blocked — remote scripts must be added via third-party scripts metadata or allowed sources, not inline.
- **Dynamic rendering**: `lwc:if` blocks re-render on branch; use `render()` + `template` getters only when you genuinely need runtime template selection.
- **Navigation**: `@salesforce/navigation` (`NavigationMixin.Navigate`/`NFeaturedLib`) moves between records/tabs; `lightning/navigation` imports `NavigationMixin` — the examiner tests that `NavigationMixin` methods are *not* directly available without the mixin.

## 7. Wire vs Imperative: The Decision Rules, Final Form

The certification typically distils LWC–server interaction to one prompt: "the component must load data with the user's permissions, must never show stale cached results, and must support a Save button". The scoring grid:

| Criterion | Wire | Imperative |
|-----------|------|-----------|
| Load-on-init | ✔ | ✔ |
| React to input changes | ✔ (reactive `$` params) | manual re-invoke |
| Cached repeat reads | ✔ (LDS cache friendly) | no cache unless cacheable |
| `@AuraEnabled(cacheable)` required | ✔ | only if you want caching |
| DML in the called method | ✘ | ✔ |
| Fresh data on explicit refresh | `refreshApex` | straightforward re-invoke |

Then remember the matching **server authoring rules**: `@AuraEnabled(cacheable=true)` methods must be **read-only** and **deterministic-ish** (no `System.now()`, no DML); mutation methods are plain `@AuraEnabled`. The repo's `LwcDataService` splits cleanly: two cacheable selectors for the wire side, one imperative DML command for the write side — and `LwcDataServiceTest` calls every method as plain static Apex, which is exactly how you validate these contracts under CI without a browser.

## 8. Testing and Tooling the Repo Expects

- **Jest** (`jest.config.js`, `sf force:lightning:lwc:test run`) runs component unit tests: mock the wire adapter, assert rendered markup, trigger events. `eslint.config.js` pins the tightest lint rules.
- When you create the practice component in Exercise 1, a sibling `__tests__` folder is `sf template generate`-compatible; verify the suite stays green in CI (Phase 12).
- Debug with **Chrome DevTools** against the bright in-page DOM, `@salesforce/debug` for server round-trip inspection, and `System.debug` server-side for Apex traces.

## Hands-On Exercises

### Exercise 1: Component shelf + wire

1. Create `force-app/main/default/lwc/accountHealthList/accountHealthList.js-meta.xml` with `apiVersion="68.0"`, `isExposed="true"`, target `lightning__RecordPage` or `__AppPage`.
2. Add the `.html`, `.js`, `.css` from Section 1; wire `getAccountsWithContacts` from `LwcDataService`.
3. Render `lightning-datatable` with `Id`, `Name`, `Health_Score__c`, `Industry`.
4. Deploy via `sf project deploy start --source-dir force-app`, open the app builder, drag the component to a page.

### Exercise 2: Imperative DML path

1. Add a button "Mark progress"; on click, imperatively import and call `recordStudyProgress(planId, 12)`.
2. Display the returned `Progress__c` value. Confirm caching: after the imperative update, an on-screen `refreshApex` re-fetch shows the new value.
3. Deliberately add an `insert` inside `getQuestionsByDomain`, deploy, and confirm the cacheable violation surfaces as an error at runtime.

### Exercise 3: Reactivity and child events

1. Add `@api recordId`, a getter `displayName`, and a `@track` array you push to from a child component's `CustomEvent`.
2. Prove the child `dispatchEvent` re-renders the parent's list without any extra imports.

### Exercise 4: Jest unit test

1. Run `sf force:lightning:lwc:test run` to sanitise the repo's jest setup.
2. Write a `__tests__/widget.test.js` that imports the component, stubs the wire with `mockWire`, and asserts rendered text.

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **LWC** | Lightning Web Component: native-Web-Components-based UI framework (HTML + JS + CSS bundle). |
| **Bundle** | The folder of `.html`, `.js`, `.css`, `.js-meta.xml` files that make one component. |
| **`@api`** | Decorator exposing a public property/method to parents and the platform. |
| **`@track`** | Decorator making nested object mutations / array reassignments reactive. |
| **`@wire`** | Declarative binding to a UI Data Service or Apex method; returns `{data, error}`. |
| **`@salesforce/apex/...`** | Import statement resolving an `@AuraEnabled` method for the client. |
| **Cacheable method** | `@AuraEnabled(cacheable=true)`: wire-eligible, **must not perform DML**. |
| **Imperative call** | Explicit imported-function invocation returning a Promise; may call DML methods. |
| **Shadow DOM** | Native style/markup scoping; LWC relies on it (no Locker relationship for LWC). |
| **CustomEvent** | Native dispatch mechanism for child→parent communication. |
| **Lightning Message Service** | Decoupled app-wide publish/subscribe channel across component boundaries. |
| **`refreshApex`** | Imperative trigger to invalidate and re-fetch a previously wired result. |

## Certification Checkpoints

- [ ] I can name the four files of an LWC bundle and their roles.
- [ ] I can write `@wire` handlers reading `data` and `error`.
- [ ] I know cacheable methods must not perform DML and why.
- [ ] I can choose wire vs imperative for a given scenario (read-only init vs user-triggered write).
- [ ] I can explain `$`-parameter reactivity (e.g. `'$recordId'`).
- [ ] I understand PDII tests LWC directly and this repo's fixtures cover that.
- [ ] I can run the repo's Jest tests with the `sf force:lightning:lwc:test` command.