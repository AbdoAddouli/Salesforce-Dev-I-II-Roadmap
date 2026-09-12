# Phase 12: Release Management and CI/CD

Encompassing the final 20% domain of both certifications, this phase turns "I wrote code" into "code shipped safely to production, repeatedly". Source control, scratch orgs, the `sf` CLI, metadata, packages, and pipelines are the machinery.

## Learning Objectives

By the end of this phase, you will be able to:
- Explain source-driven development and the project layout (`sfdx-project.json`, `force-app`, `.forceignore`).
- Create and open scratch orgs and push/pull source with the `sf` CLI.
- Use the Metadata API with `manifest/package.xml` and run destructive deployments.
- Explain change sets and the packaging classes (unmanaged, unlocked, managed).
- Run test deployments (`sf apex run test -c`) and manage permission sets/profiles as deployable metadata.
- Describe a GitHub Actions-style CI/CD pipeline with pre-deploy static analysis.

## 1. Source-Driven Development

Salesforce DX's promise: your **source of truth lives in version control**, not inside an org. The repo's layout is the certified norm:

```
sfdx-project.json          # package directories, namespace, sourceApiVersion
config/                    # scratch org definitions (config/project-scratch-def.json)
force-app/main/default/    # deployable metadata (classes/, triggers/, objects/, lwc/, flows/, ...)
manifest/package.xml       # explicit metadata manifest for deploy/retrieve
.forceignore               # paths excluded from source operations (e.g. .sf/, .sfdx/)
```

- `sfdx-project.json` pins `"sourceApiVersion": "68.0"` — the API version every artifact in this repo compiles against.
- **Scratch orgs** are disposable, 30-day environments created from a definition:

```
sf org create scratch -f config/project-scratch-def.json -a dev
sf org open -o dev
```

Scratch orgs are *source-tracked*: `sf project deploy start` pushes local source, and `sf status` shows what changed on each side. They are the correct environment for experiments (PR branches) precisely because they are throwaway.

## 2. The Salesforce CLI (`sf`)

The commands the exam wants you to recognise cold:

| Command | What it does |
|---------|--------------|
| `sf org login web` | authorize a real org (DevHub, sandbox, production) |
| `sf org create scratch -f config/project-scratch-def.json -a dev` | create scratch org from definition |
| `sf project deploy start --source-dir force-app` | push all source metadata to the target org |
| `sf project retrieve start --source-dir force-app` | pull source from the target org |
| `sf apex run test -c` | run all tests and print per-class coverage |
| `sf apex run test -r human` | human-readable test report |
| `sf data create record --sobject Account --values "Name=Acme"` | seed data |
| `sf org open -o dev` | open the org's browser UI |

Notes: `--target-org` overrides the default; `--test-level` (AddTests via `-t`) controls deploy-time testing (`RunLocalTests`, `RunAllTestsInOrg`, `RunSpecifiedTests`, `NoTestRun`). **Production deploys require passing tests and ≥75% coverage** (Phase 9). Metadata-like artifacts (permission sets, profiles, validation rules) ride along in `force-app` exactly like classes.

## 3. Metadata API and the Manifest

The **Metadata API** treats all configuration as retrievable/deployable XML. Two deployment shapes:

- **Manifest-driven**: `package.xml` lists `<types><members>…</members><name>…</name></types>` groups. The repo's `manifest/package.xml` declares wildcard members (`*`) for `ApexClass`, `ApexTrigger`, `AuraDefinitionBundle`, `LightningComponentBundle`, `StaticResource`, and more, all at `<version>68.0</version>`.
- **Source-driven**: `sf project deploy start --source-dir force-app` computes its own manifest from the folder — faster for day-to-day, equivalent to the Metadata API for the deploy pipeline.

**Destructive changes** remove metadata. Create a `destructiveChanges.xml` + matching `package.xml`, send both, and the platform **deletes the files first, then updates**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>StaleTrigger</members>
        <name>ApexTrigger</name>
    </types>
    <version>68.0</version>
</Package>
```

Deletion workflows belong in CI, staged across a *deploy → delete* sequence, and require the same test-coverage gate as any deploy.

## 4. Change Sets and Packages

Three delivery mechanisms, knowing-when-to-use is the exam:

| Mechanism | Use when | Characteristics |
|-----------|----------|-----------------|
| **Change sets / deployment connections** | sandbox to sandbox/production, no CLI | UI-driven; only via an org-to-org connection; **no source tracking, no version control** |
| **Unmanaged packages** | distributing config to anyone | contents not locked; consumers can edit; the "install my component library" case |
| **Managed package (1GP/2GP)** | ISV distribution | namespaced, versioned, upgradable, protected; consumers can't edit packaged Apex |
| **Unlocked package (2GP)** | modular source between orgs | source rules enforced, versioned, ingredients still editable where allowed |
| **Source / unmanaged raw** | your own CI | `force-app` folders + CLI |

The distinction the exam loves: managed packages **cannot modify** consumer orgs' configurations and live behind a namespace; unmanaged packages can be edited after install; change sets *cannot* be applied via API-only flows (they need the metadata-generation path of a recognizable org connection and their own rollback limit).

Packages use **versioned metadata** (`packageVersion`, `sf package version create`) with a namespace from `sfdx-project.json`. For the typical certification scenario you describe "deploy source to scratch → package as unlocked → release to a DevOps environment" as the enterprise-grade pipeline.

## 5. Permission Sets and Profiles as Metadata

Security artifacts are first-class metadata:

- **Permissions sets** (`permissionSet-meta.xml`) define feature/object/field grants and are **referenced by name** in profiles and `Setup → Assignment`.
- **Profiles** (`profile-meta.xml`) list permissions + assigned permissions sets and are deployable but notoriously verbose/merging-sensitive — deploy **permission sets before profiles** so the assignments exist when profiles reference them.
- The deploy order matters for the exam: create/retrieve objects and fields before the permission sets that reference them; run triggers deploy at the *end* so they never block a partial push.

The repo models the pattern: its metadata includes object-meta XML (custom objects/fields) and every service class references the same objects; a CI pipeline that orders `objects → fields → permission sets → classes/triggers → tests` reproduces happy-path automation.

## 6. CI/CD: The Pipeline

**Continuous integration** = every merge triggers automated validation; **continuous delivery** = validated artifacts are deployable to environments on demand. A canonical GitHub Actions pipeline for a Salesforce repo looks like:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Salesforce CLI
        run: npm install --global @salesforce/cli
      - name: Authorize DevHub
        run: echo "${{ secrets.SF_AUTH_URL }}" | sf org login sfdx-url --set-default-dev-hub
      - name: Create scratch org
        run: sf org create scratch -f config/project-scratch-def.json -a ci -d 1
      - name: Deploy source
        run: sf project deploy start --source-dir force-app --target-org ci
      - name: Run tests with coverage
        run: sf apex run test -c --target-org ci --test-level RunLocalTests
      - name: Lint and scan
        run: |
          npm run lint            # eslint (LWC) / prettier
          sf scanner run --format sarif --target force-app  # PMD/Apex Scanner via plugin
      - name: Teardown
        run: sf org delete scratch --target-org ci
```

Pipeline hygiene the cert checks:

- **Pre-deploy gates**: `sf scanner` (PMD-based Apex static analysis), `eslint` for LWC, `prettier --check`, and `sf project deploy preview` to sanity the change. **Fail the build on lint/scan errors before tests even run.**
- **Secrets**: auth via `SFDX_AUTH_URL`-style JWTs/private-key runners, never in source.
- **Branch strategy**: feature branches → scratch org per PR → merged into `main` → deploy to sandbox → promote via change set/package to production.
- **`.forceignore`** excludes `.sf`, `.sfdx`, scratch caches, and transient files from both blunt and precise sources; the repo's `.forceignore` + `.gitignore` play this role so CI retries map only to real changes.
- **Rollback**: destructive changes + redeployment of a prior tag/commit is your immediate recovery; managed packages give durable versioning when the deliverable is external.
- **Version control hygiene**: descriptive commits, signed tags for releases, test-first service classes, and never committing `*.credentials` or scratch-org URLs. The repo's `.husky/pre-commit` hook runs exactly such checks at commit time.

## 7. Metadatakategorier and Deploy Order Cheat Sheet

Knowing *what* lives where makes pipeline design concrete. The repo's surface:

| Metadata type | Folder | Deploy note |
|---------------|--------|-------------|
| `ApexClass` | `classes/` | compiled at deploy time — must be together with everything it references |
| `ApexTrigger` | `triggers/` | one file per event set |
| Custom objects/fields | `objects/<api>__c/` | parent object must deploy before dependent fields |
| Permissions sets / profiles | `permissionsets/` / `profiles/` | deploy permission sets **before** profiles that assign them |
| LWC/Aura | `lwc/`, `aura/` | bundle folders deploy as one unit |
| Flows | `flows/` | versioned; activate the version you deploy |
| Custom labels, staticresources, layouts, page layouts | `labels/`, `staticresources/`, `layouts/` | referenced by pages/components — order matters |

General deploy order for any instance: **objects → fields → custom metadata/labels → permission sets → classes/triggers → flows → pages/components → profiles → (destructive changes last)**. A manifest that references a class in one `<types>` block halfway mirrors that; the CI "dry run" (`sf project deploy preview`) validates ordering *before* the real push.

## 8. Package Lifecycle in Practice

The sequence a PDII candidate should narrate:

1. **Source in `force-app`** (this repo) — version-controlled, `sf` deployable.
2. **Unlocked package** (`sf package create ... --package-type Unlocked --path force-app`) — namespaced-optional, versioned metadata bundle; installable to other Dev/sandbox/production orgs with its own API version lane.
3. **Package versions** — immutable snapshots consumed by CI (upgrade/downgrade tests) and by `sfdx-project.json`'s `packageAliases`.
4. **Managed package** — adds the namespace + copyright protection + ISV upgrade mechanics; out of scope for daily engineering but in scope for "who can install what".

Change sets, in contrast, are **unmanaged by code and ungatherable to version control** — the exam's signature question: "build CI/CD without change sets" → use packages/deploy CLI.

## 9. Troubleshooting Release Runs

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Deploy fails on compile | a class references metadata not yet deployed | order the deploy; use manifests; `sf project deploy preview` |
| Tests fail in production but pass in scratch | data-dependence in tests (SeeAllData) | isolate tests to created data |
| "Error (ApexException)": `LIMIT` in trigger at deploy-test | trigger fires during deploy tests | structure triggers for bulk; reduce DML in the trigger path |
| Coverage below 75% only in prod | prod has more classes untested | run `sf apex run test -c` org-wide before promoting |
| Destructive change deleted too early | destructive ran before metadata replacement | separate "update" and "destructiveChanges" phases in your pipeline |
| Scratch org "cannot find metadata" | stale `.forceignore` excludes the folder | verify the ignore list | 

That table is a mini runbook: the same four rows cover the majority of actual release incidents on certification-day scenario questions.

## Hands-On Exercises

### Exercise 1: Scratch org lifecycle

1. `sf org create scratch -f config/project-scratch-def.json -a dev`
2. `sf project deploy start --source-dir force-app --target-org dev`
3. `sf apex run test -c --target-org dev --test-level RunLocalTests --result-format human`
4. `sf org delete scratch --target-org dev --no-prompt` and repeat for the *second* scratch (prove you can throw one away cleanly).

### Exercise 2: Manifest rounds trip

1. Read `manifest/package.xml`; run `sf project deploy start --manifest manifest/package.xml --target-org <sandbox>`.
2. Add a class to `force-app`, re-run, and observe only the delta deploys.
3. Write a `destructiveChanges.xml` for a dummy trigger, deploy it with its empty `package.xml`, and confirm the removal on the target.

### Exercise 3: Package the roadmap

1. Play the unlocked-package path: `sf package create --name roadmap --package-type Unlocked --path force-app` (namespace empty in this repo).
2. Build a package version and explain in writing why the *packaged* artifact would or would not include `.forceignore`-excluded files.

### Exercise 4: CI gate in a fork

1. Replicate the GitHub Actions YAML into a `.github/workflows/ci.yml`.
2. Trigger a PR; watch lint (`eslint.config.js`) fail the build; fix the violation; note the pipeline's gate order (scan before tests).

## Key Terms Glossary

| Term | Definition |
|------|-----------|
| **Source-driven development** | Version-control-first workflow; metadata is source, orgs are environments. |
| **Scratch org** | Disposable, source-tracked, 30-day development org from `project-scratch-def.json`. |
| **`sf` CLI** | Current Salesforce CLI; deploy/retrieve/test/org commands at `sf ...`. |
| **Manifest** | `package.xml` declaring the set of metadata to deploy/retrieve. |
| **`destructiveChanges.xml`** | Deletion manifest applied before/with a deploy to remove metadata. |
| **Change set / deployment connection** | UI-driven sandbox-to-sandbox metadata delivery. |
| **Unlocked package** | 2GP modular, versioned source package with source-enforced rules. |
| **Managed package** | Namespaced, versioned, protected deliverable for ISV distribution. |
| **Permission set** | Reusable metadata grant bundle assigned by name to users/profiles. |
| **CI/CD** | Continuous integration: automated validation on every merge; delivery on demand. |
| **Static analysis** | Pre-deploy code scanning (PMD-style `sf scanner`, `eslint`). |
| **`.forceignore`** | Exclusion list for CLI source operations and deployments. |

## Certification Checkpoints

- [ ] I can list the four `sf project deploy`-style commands and the test-level options.
- [ ] I can read and explain `manifest/package.xml` members and API `<version>`.
- [ ] I know the difference between managed, unlocked, and unmanaged packages — and when change sets are preferred.
- [ ] I can describe a GitHub Actions pipeline with order: scan → scratch → deploy → test with coverage → teardown.
- [ ] I can deploy permission sets before profiles and order metadata so `package.xml` never references missing parts.
- [ ] I know `destructiveChanges.xml` deletes first, updates after.
- [ ] I can justify a scratch-org-per-PR branch strategy and name what `.forceignore` protects.