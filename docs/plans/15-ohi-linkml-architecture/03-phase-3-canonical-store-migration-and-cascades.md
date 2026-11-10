# Phase 3: Option 2A Canonical LinkML Document Store & Symbol Cascades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: `open`

**Goal:** Migrate the PostgreSQL Drizzle schema to Option 2A (storing canonical `linkml_yaml`, `ohi_yaml`, `ohi_lockfile`, `ui_layout`, and `compiled_artifacts` on `ontology_documents`, dropping the 14 redundant SQL tables, and switching the 3 external boundaries to `text` LinkML symbol keys), implement transactional `cascadeSymbolRename` / `cascadeSymbolDelete`, and refactor all ontology/tabular server queries and write actions to operate on `linkml_yaml`.

**Architecture:** `src/server/db/schema.ts` drops the 13 ontology-internal relational tables (`ontology_modules`, `ontology_classes`, `ontology_attributes`, `ontology_relations`, `ontology_relation_attributes`, `ontology_class_positions`, `ontology_module_layout`, `ontology_languages`, `ontology_notes`, `ontology_localized_texts`, `ontology_examples`, `ontology_class_disjointness`, `ontology_class_restrictions`) plus `registry_endpoint_snapshots`. A single server helper (`loadCanonicalOntology` / `saveCanonicalOntology`) in `src/features/ontology/server/linkml/document-store.ts` reads/writes `ontology_documents.linkml_yaml` + `ui_layout` and projects the existing TypeScript DTOs (`OntologyClass`, `OntologyRelation`, `OntologyModule`, `OntologyAttribute`) so the UI works without component rewrites.

**Tech Stack:** Drizzle ORM (`1.0.0-rc.4`), PostgreSQL, TypeScript, `@neverblink/linkml@0.18.2`.

**Spec:** `docs/superpowers/specs/2026-11-10-ohi-linkml-integration-design.md` (Sections 5.1, 5.2, 5.3)

## Global Constraints

- Update `src/server/db/schema.ts` alongside a new SQL migration in `drizzle/` (`pnpm db:generate`) and update `supabase/seed.sql`.
- Preserve `group_key` access control in `src/server/group-access.ts` (validate ownership via `ontology_documents` instead of deleted sub-tables).
- All renames and deletions of classes, relations, attributes, or modules must run inside `db.transaction` and invoke `cascadeSymbolRename` / `cascadeSymbolDelete`.
- Run `pnpm check` at the end of the phase.

## Review Focus

1. **Attribute Value Cascade on Class Rename:** Renaming class `"Person"` → `"Individual"` must update both `document_entities.class_id` (`"Person"` → `"Individual"`) AND prefix-match `entity_attribute_values.attribute_id` (`"Person.age"` → `"Individual.age"`).
2. **Orphan Cleanup on Class/Relation Delete:** Deleting a class or relation must null out `document_entities.class_id`, `facts.relation_type_id`, and `ontology_cq_triples` references (and delete associated `entity_attribute_values` / `fact_relation_attribute_values`) inside the transaction, matching the old PostgreSQL foreign key behavior.
3. **Raw LinkML YAML Edit Diffing:** When a user saves raw `linkml_yaml` text that removes a class or slot, `diffLinkmlAstSymbols` must detect the removed symbols and run `cascadeSymbolDelete` so external tables never retain dangling keys.
4. **Access Control without Child SQL Tables:** `assertOntologyRecordAccess` in `src/server/group-access.ts` must resolve access via `ontologyId` (or composite `(ontologyId, symbolKey)`) since child SQL tables no longer exist.
5. **Seed Database Compatibility:** `supabase/seed.sql` must seed `ontology_documents` with valid `linkml_yaml`, `ohi_yaml`, `ohi_lockfile`, and `ui_layout`, and use symbol keys in seeded `facts`, `document_entities`, and `ontology_competency_questions`.

---

### Task 1: Drizzle Schema Refactor, Domain Types & SQL Migration (Slice 3.1) `closed`

**Files:**

- Modify: `src/server/db/schema.ts`
- Modify: `src/domain/ontology.ts`
- Modify: `src/domain/documents.ts`
- Modify: `src/server/group-access.ts`
- Create: `drizzle/YYYYMMDDHHMMSS_linkml_canonical_store/migration.sql`
- Modify: `supabase/seed.sql`
- Test: `tests/canonical-db-schema.test.ts`

**Interfaces:**

- Produces:
  - Updated `ontologyDocuments` table with `linkml_yaml`, `ohi_yaml`, `ohi_lockfile`, `ui_layout`, `compiled_artifacts`
  - Updated `referenceOntologies` table with `ontology_id`, `publication_url`, `artifact_url`, `artifact_format`, `sha256`, `artifact_content`, `is_transitive`
  - Updated `extractionRuns` table with `ohi_lockfile_snapshot`, `ontology_sha256`
  - Updated `text` symbol columns on `facts`, `documentEntities`, `entityAttributeValues`, `factRelationAttributeValues`, `ontologyCompetencyQuestions`, `ontologyCqTriples`, `ontologyCompetencyQuestionModules`
  - Pure TypeScript DTO interfaces in `src/domain/ontology.ts` (`OntologyModule`, `OntologyClass`, `OntologyAttribute`, `OntologyRelation`, `OntologyRelationAttribute`, etc.) preserving exact field names for UI compatibility

- [ ] **Step 1: Write failing schema & DTO contract test**
      Create `tests/canonical-db-schema.test.ts` verifying the new columns on `ontologyDocuments`, `referenceOntologies`, and `extractionRuns`, `text` symbol columns on external tables, and removal of the 14 dropped tables from `schema.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/canonical-db-schema.test.ts`

- [ ] **Step 3: Update `src/server/db/schema.ts`, `src/domain/ontology.ts`, `src/domain/documents.ts`, `src/server/group-access.ts`, and `supabase/seed.sql`, then generate Drizzle migration**

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/canonical-db-schema.test.ts`

- [ ] **Step 5: Commit**
      `git add src/server/db/schema.ts src/domain/ src/server/group-access.ts drizzle/ supabase/seed.sql tests/canonical-db-schema.test.ts`
      `git commit -m "feat(db): migrate schema to Option 2A canonical LinkML store and symbol keys"`

---

### Task 2: Transactional Symbol Cascade Service & AST Diff Engine (Slice 3.2) `closed`

**Files:**

- Create: `src/features/ontology/server/linkml/symbol-cascade.ts`
- Create: `src/features/ontology/server/linkml/document-store.ts`
- Test: `tests/linkml-symbol-cascade.test.ts`

**Interfaces:**

- Consumes: `CanonicalOntologySnapshot`, `linkmlYamlToSnapshot`, `snapshotToLinkmlYaml`, `compileLinkmlOntology`
- Produces:
  - `diffLinkmlSnapshots(before: CanonicalOntologySnapshot, after: CanonicalOntologySnapshot): SymbolDiffReport`
  - `cascadeSymbolRename(tx: DbTransaction, ontologyId: string, kind: "class" | "relation" | "attribute" | "module", oldKey: string, newKey: string): Promise<void>`
  - `cascadeSymbolDelete(tx: DbTransaction, ontologyId: string, kind: "class" | "relation" | "attribute" | "module", deletedKey: string): Promise<void>`
  - `loadCanonicalOntology(ontologyId: string, db?: DbClient): Promise<CanonicalOntologySnapshot>`
  - `saveCanonicalOntology(ontologyId: string, mutator: (draft: CanonicalOntologySnapshot) => void | Promise<void>, options?: { recompile?: boolean }): Promise<CanonicalOntologySnapshot>`

- [x] **Step 1: Write failing tests for symbol diffing and rename/delete cascade plans**
      Create `tests/linkml-symbol-cascade.test.ts` testing class rename (`"Person"` → `"Individual"` cascading to `"Individual.age"`), relation rename, class delete, and raw LinkML diff detection.

- [x] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-symbol-cascade.test.ts`

- [x] **Step 3: Implement `symbol-cascade.ts` and `document-store.ts`**

- [x] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/linkml-symbol-cascade.test.ts`

- [x] **Step 5: Commit**
      `git add src/features/ontology/server/linkml/symbol-cascade.ts src/features/ontology/server/linkml/document-store.ts tests/linkml-symbol-cascade.test.ts`
      `git commit -m "feat(ontology): add transactional symbol cascade service and canonical document store"`

---

### Task 3: Refactor Ontology Server Queries & Blast Radius to Read from `linkml_yaml` (Slice 3.3) `open`

**Files:**

- Modify: `src/features/ontology/server/queries/classes.ts`
- Modify: `src/features/ontology/server/queries/relations.ts`
- Modify: `src/features/ontology/server/queries/modules.ts`
- Modify: `src/features/ontology/server/queries/layout.ts`
- Modify: `src/features/ontology/server/queries/languages.ts`
- Modify: `src/features/ontology/server/queries/metadata.ts`
- Modify: `src/features/ontology/server/queries/relation-attributes.ts`
- Modify: `src/features/ontology/server/blast-radius/queries.ts`
- Modify: `src/features/documents/server/queries/` (ontology context queries)
- Test: `tests/linkml-queries-projection.test.ts`

**Interfaces:**

- Consumes: `loadCanonicalOntology` from `document-store.ts`
- Produces: Existing query signatures (`getOntologyClasses`, `getOntologyRelations`, `getOntologyModules`, `getOntologyLayout`, `getOntologyMetadata`, `getBlastRadiusData`) reading from `ontology_documents.linkml_yaml` + `ui_layout`.

- [ ] **Step 1: Write failing tests for DTO query projection and Blast Radius calculation over LinkML snapshots**
      Create `tests/linkml-queries-projection.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-queries-projection.test.ts`

- [ ] **Step 3: Refactor query files in `src/features/ontology/server/queries/`, `blast-radius/queries.ts`, and `src/features/documents/server/queries/`**

- [ ] **Step 4: Run test to verify it passes**
      Run: `npm exec pnpm -- test tests/linkml-queries-projection.test.ts`

- [ ] **Step 5: Commit**
      `git add src/features/ontology/server/queries/ src/features/ontology/server/blast-radius/ src/features/documents/server/queries/ tests/linkml-queries-projection.test.ts`
      `git commit -m "refactor(ontology): project ontology queries and blast radius from canonical LinkML store"`

---

### Task 4: Refactor Ontology & Tabular Server Write Actions (Slice 3.4) `open`

**Files:**

- Modify: `src/features/ontology/server/actions/ontology-documents.ts`
- Modify: `src/features/ontology/server/actions/classes.ts`
- Modify: `src/features/ontology/server/actions/class-refactoring.ts`
- Modify: `src/features/ontology/server/actions/attributes.ts`
- Modify: `src/features/ontology/server/actions/relations.ts`
- Modify: `src/features/ontology/server/actions/relation-attributes.ts`
- Modify: `src/features/ontology/server/actions/modules/`
- Modify: `src/features/ontology/server/actions/layout.ts`
- Modify: `src/features/ontology/server/actions/languages.ts`
- Modify: `src/features/ontology/server/actions/localized-texts.ts`
- Modify: `src/features/ontology/server/actions/notes.ts`
- Modify: `src/features/ontology/server/actions/examples.ts`
- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Modify: `src/features/ontology/server/actions/ontology-transfer/`
- Modify: `src/features/tabular/server/actions/commit-dataset-mapping.ts`
- Test: `tests/linkml-actions-mutations.test.ts`

**Interfaces:**

- Consumes: `saveCanonicalOntology`, `cascadeSymbolRename`, `cascadeSymbolDelete`
- Produces: All server actions mutating `ontology_documents.linkml_yaml` + `ui_layout`, running cascades inside transactions, and updating `compiled_artifacts`.

- [ ] **Step 1: Write failing tests for class/relation/attribute/module CRUD, `reconcileAndAdoptClass`, AI draft commit, and `commitDatasetMappingAction` against the LinkML document store**
      Create `tests/linkml-actions-mutations.test.ts`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `npm exec pnpm -- test tests/linkml-actions-mutations.test.ts`

- [ ] **Step 3: Refactor all server write actions in `src/features/ontology/server/actions/` and `commit-dataset-mapping.ts`**

- [ ] **Step 4: Run full check suite**
      Run: `npm exec pnpm -- check`
      Expected: All lint, typecheck, test, and build checks PASS.

- [ ] **Step 5: Commit**
      `git add src/features/ontology/ src/features/tabular/ tests/`
      `git commit -m "refactor(ontology): migrate all ontology and tabular write actions to canonical LinkML store"`
