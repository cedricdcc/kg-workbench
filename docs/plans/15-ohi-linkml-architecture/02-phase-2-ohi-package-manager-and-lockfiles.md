# Phase 2: `ohi.dev` Package Manager, SHA-256 Lockfiles & Registry Replacement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: `open`

**Goal:** Replace the legacy multi-registry scrapers (OLS4, LOV, BARTOC, OntoPortal, EU Vocabularies) with `ohi.dev` as the sole external ontology package manager, supporting `ohi.yaml` manifests, `ohi.lock.json` v2 cryptographic SHA-256 verification, transitive dependency resolution, and LinkML `importMap` wiring.

**Architecture:** `src/features/ontology/server/ohi/` manages `ohi.yaml` and `ohi.lock.json` v2 per ontology document. When a user adds a package (e.g. `w3c/dcat@3` or `w3c/prov-o@2013`), the lockfile manager resolves its immutable publication and transitive dependencies (`dublincore/dcterms@2020`, `w3c/skos@2009`, `w3c/prov-o@2013`), verifies SHA-256 checksums, stores the artifact content (`linkml-yaml` / `owl-turtle`) in `reference_ontologies`, indexes terms + 384-d embeddings into `reference_ontology_terms`, and feeds `imports` + `importMap` into `@neverblink/linkml`.

**Tech Stack:** TypeScript, Node.js `crypto` (SHA-256), Drizzle ORM, PostgreSQL, `@neverblink/linkml@0.18.2`.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md` (Sections 5.1 & 5.5)

## Global Constraints

- Never call external catalog APIs from the browser; all `ohi.dev` fetches run on the server.
- Enforce SHA-256 verification on every artifact load/sync: if a stored or downloaded artifact's SHA-256 digest does not match `ohi.lock.json`, throw a typed `OhiLockfileDriftError`.
- Provide deterministic built-in publication descriptors and embedded canonical LinkML/Turtle artifacts for core W3C/standard packages (`w3c/prov-o@2013`, `w3c/dcat@3`, `w3c/skos@2009`, `dublincore/dcterms@2020`, `w3c/ssn@2017`, `w3c/org@2014`, `foaf/foaf@0.1`, `schemaorg/schema@28`) so offline development and CI tests never fail due to network outages.
- Run `pnpm check` at the end of the phase.

## Review Focus

1. **SHA-256 Tamper / Drift Detection:** Modifying a single byte of a cached artifact in `reference_ontologies.artifact_content` when `ohi.lock.json` has a pinned `sha256` must cause `verifyOhiLockfile` / `syncOhiDependencies` to reject the tampered file and report the exact mismatched package path.
2. **Transitive Dependency Cycle & Deduplication:** Adding `w3c/dcat@3` and `w3c/prov-o@2013` together (where `dcat@3` transitively depends on `prov-o@2013`) must deduplicate `w3c/prov-o@2013` in `ohi.lock.json` `files[]` while keeping only explicit user requests in `selections[]`.
3. **Diamond Version Conflict:** If package A depends on `X@1` and package B depends on `X@2`, `ohi.lock.json` must keep their distinct version paths (`.ohi/ns/X/1/...` vs `.ohi/ns/X/2/...`) and record both cleanly.
4. **Offline / Air-Gapped Execution:** Searching and adding core packages (`w3c/dcat@3`, `w3c/prov-o@2013`, `w3c/skos@2009`, `dublincore/dcterms@2020`) must succeed with verified SHA-256 digests even when `fetch` to external URLs is disabled.
5. **LinkML `importMap` Resolution:** Once an `ohi` dependency is locked, compiling an ontology that `imports:` that dependency's URI via `compileLinkmlOntology` must resolve the imported classes/slots from the locked artifact without UnknownReference errors.

---

### Task 1: Define `ohi.yaml` & `ohi.lock.json` v2 Types and Parser (Slice 2.1) `open`

**Files:**

- Create: `src/features/ontology/server/ohi/types.ts`
- Create: `src/features/ontology/server/ohi/manifest.ts`
- Test: `tests/ohi-manifest-and-lockfile.test.ts`

**Interfaces:**

- Produces:
  - `OhiFormat`: `"owl-turtle" | "owl-rdfxml" | "rdfs-turtle" | "linkml-yaml" | "ossie-yaml"`
  - `OhiManifest` (`format_version: 1`, `default_format: OhiFormat`, `download_dir: string`, `dependencies: Array<{ ontology: string; format?: OhiFormat }>`)
  - `OhiLockfileV2` (`lock_version: 2`, `selections: OhiLockSelection[]`, `files: OhiLockedFile[]`)
  - `parseOhiYaml(yamlText: string): OhiManifest`
  - `serializeOhiYaml(manifest: OhiManifest): string`
  - `computeSha256(content: string | Uint8Array): string`

- [ ] **Step 1: Write failing tests for `ohi.yaml` parsing/serialization and SHA-256 computation**
      Create `tests/ohi-manifest-and-lockfile.test.ts` testing round-trip YAML formatting for the spec's exact `ohi.yaml` example (`w3c/dcat@3`, `w3c/prov-o@2013`) and SHA-256 digest verification.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/ohi-manifest-and-lockfile.test.ts`

- [ ] **Step 3: Implement `src/features/ontology/server/ohi/types.ts` and `manifest.ts`**

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/ohi-manifest-and-lockfile.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/ohi/types.ts src/features/ontology/server/ohi/manifest.ts tests/ohi-manifest-and-lockfile.test.ts`
      `git commit -m "feat(ohi): add ohi.yaml manifest parser and ohi.lock.json v2 types"`

---

### Task 2: Implement `ohi.dev` Catalog Client & Transitive Resolver (Slice 2.2) `open`

**Files:**

- Create: `src/features/ontology/server/ohi/catalog-client.ts`
- Create: `src/features/ontology/server/ohi/builtin-publications.ts`
- Test: `tests/ohi-catalog-resolver.test.ts`

**Interfaces:**

- Consumes: `OhiManifest`, `OhiLockfileV2`, `OhiFormat`, `computeSha256`
- Produces:
  - `searchOhiPackages(query: string, options?: { limit?: number }): Promise<OhiPackageSummary[]>`
  - `inspectOhiPublication(ontologyRef: string): Promise<OhiPublicationMetadata>`
  - `resolveOhiDependencyTree(manifest: OhiManifest): Promise<{ lockfile: OhiLockfileV2; artifacts: Map<string, string> }>`

- [ ] **Step 1: Write failing tests for transitive resolution (`w3c/dcat@3` → `dcterms`, `skos`, `prov-o`) and deduplication**
      Create `tests/ohi-catalog-resolver.test.ts` verifying that adding `w3c/dcat@3` resolves its transitive dependencies in the target format (`linkml-yaml` or `owl-turtle`), populates `selections` and `files` with immutable URLs and SHA-256 digests, and deduplicates shared transitive dependencies.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/ohi-catalog-resolver.test.ts`

- [ ] **Step 3: Implement `builtin-publications.ts` and `catalog-client.ts`**
      Include canonical LinkML YAML and OWL Turtle publications for `w3c/prov-o@2013`, `w3c/dcat@3`, `w3c/skos@2009`, `dublincore/dcterms@2020`, `w3c/ssn@2017`, `w3c/org@2014`, `foaf/foaf@0.1`, and `schemaorg/schema@28` with live `ohi.dev` HTTP lookup + built-in fallback.

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/ohi-catalog-resolver.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/ohi/builtin-publications.ts src/features/ontology/server/ohi/catalog-client.ts tests/ohi-catalog-resolver.test.ts`
      `git commit -m "feat(ohi): implement ohi.dev catalog client and transitive dependency resolver"`

---

### Task 3: Lockfile Verifier, Drift Detector & LinkML Import Map Builder (Slice 2.3) `closed`

**Files:**

- Create: `src/features/ontology/server/ohi/lockfile-verifier.ts`
- Create: `src/features/ontology/server/ohi/import-map.ts`
- Test: `tests/ohi-lockfile-verifier.test.ts`

**Interfaces:**

- Consumes: `OhiLockfileV2`, `computeSha256`, `compileLinkmlOntology`
- Produces:
  - `verifyOhiLockfileArtifacts(lockfile: OhiLockfileV2, storedArtifacts: Record<string, string>): OhiLockVerificationReport`
  - `buildLinkmlImportsFromOhi(lockfile: OhiLockfileV2, storedArtifacts: Record<string, string>): { imports: Record<string, string>; importMap: Record<string, string> }`

- [x] **Step 1: Write failing tests for SHA-256 drift detection and LinkML `importMap` compilation**
      Create `tests/ohi-lockfile-verifier.test.ts` testing: 1. Clean verification when all SHA-256 digests match. 2. Drift/tamper error when a cached artifact string is modified. 3. Compiling an ontology that imports `w3c/prov-o@2013` via `buildLinkmlImportsFromOhi` + `compileLinkmlOntology`.

- [x] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/ohi-lockfile-verifier.test.ts`

- [x] **Step 3: Implement `lockfile-verifier.ts` and `import-map.ts`**

- [x] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/ohi-lockfile-verifier.test.ts`

- [x] **Step 5: Commit**
      `git add src/features/ontology/server/ohi/lockfile-verifier.ts src/features/ontology/server/ohi/import-map.ts tests/ohi-lockfile-verifier.test.ts`
      `git commit -m "feat(ohi): add SHA-256 lockfile verifier and LinkML importMap builder"`

---

### Task 4: Replace Legacy Vocabulary Registries with `ohi.dev` Service Layer (Slice 2.4) `closed`

**Files:**

- Modify: `src/features/ontology/server/services/vocabulary-registries/index.ts`
- Modify: `src/features/ontology/server/services/vocabulary-registries/domain-discovery.ts`
- Modify: `src/features/ontology/server/actions/reference-vocabularies.ts`
- Delete: `src/features/ontology/server/services/vocabulary-registries/ols4-client.ts`
- Delete: `src/features/ontology/server/services/vocabulary-registries/lov-client.ts`
- Delete: `src/features/ontology/server/services/vocabulary-registries/providers/`
- Modify: `tests/` (update any legacy registry tests to test `ohi.dev` provider)

**Interfaces:**

- Consumes: `searchOhiPackages`, `inspectOhiPublication`, `resolveOhiDependencyTree`
- Produces:
  - Updated `reference-vocabularies.ts` actions (`searchOhiRegistryAction`, `addReferenceOntology`, `syncReferenceOntology`) backed solely by `ohi.dev`.

- [x] **Step 1: Update registry service & actions to route exclusively through `src/features/ontology/server/ohi/`**
      Remove OLS4, LOV, BARTOC, OntoPortal, and EU Vocabularies provider files and wire `reference-vocabularies.ts` and `domain-discovery.ts` to `ohi.dev`.

- [x] **Step 2: Run full check suite**
      Run: `npm exec pnpm -- check`
      Expected: All lint, typecheck, test, and build checks PASS.

- [x] **Step 3: Commit**
      `git add -A src/features/ontology/server/ tests/`
      `git commit -m "refactor(ontology): replace legacy vocabulary registries with ohi.dev package manager"`
