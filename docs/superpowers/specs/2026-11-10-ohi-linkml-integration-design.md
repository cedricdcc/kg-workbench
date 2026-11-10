# Design Specification: `ohi.dev` & `@neverblink/linkml` Canonical Architecture

- **Date:** 2026-11-10
- **Status:** Draft (Pending Builder Check & User Approval)
- **Scope:** Project-wide architectural refactor across `src/server/db/`, `src/features/ontology/`, `src/features/documents/`, `src/features/tabular/`, `services/internal-extractor/`, and `services/reasoner/`.

---

## 1. Intent and Why

`kg-workbench` currently spreads ontology state across 12+ relational PostgreSQL tables (`ontology_classes`, `ontology_attributes`, `ontology_relations`, `ontology_modules`, etc.), uses handwritten string builders for SHACL ([`src/features/ontology/server/shacl/generator.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/ontology/server/shacl/generator.ts)) and OWL ([`src/features/ontology/server/owl-export/rdf.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/ontology/server/owl-export/rdf.ts)), fetches unverified terms from live vocabulary endpoints (OLS4, LOV, BARTOC, OntoPortal, EU Vocabularies), and sends a flat, untyped dictionary to `neo4j-graphrag` during document extraction ([`services/internal-extractor/src/internal_extractor/schema_mapper.py`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/services/internal-extractor/src/internal_extractor/schema_mapper.py)).

We are refactoring `kg-workbench` to use **`ohi.dev`** and **`@neverblink/linkml` (`0.18.2`)** as the unified foundation for ontology modeling, package management, multi-format code generation, and document extraction:

1. **Single Canonical Source of Truth:** Every ontology document in `kg-workbench` is canonically stored as a **LinkML YAML schema** (`linkml_yaml`) paired with an **`ohi.yaml` manifest** and a cryptographic **`ohi.lock.json` v2 lockfile** (`ohi_lockfile`).
2. **Deterministic Dependency & Provenance Tracking:** `ohi.dev` replaces all legacy vocabulary registries. External ontologies (e.g., `w3c/dcat@3`, `w3c/prov-o@2013`) are resolved with their full transitive dependency trees, pinned to immutable timestamped publications, and verified via SHA-256 digests.
3. **Single-Source Multi-Format Compilation:** Using `@neverblink/linkml` (`LinkML.loadFromString`, `view.shacl()`, `view.rdfs()`, `view.owl()`, `view.pydantic()`, `view.jsonSchema()`, `view.frictionless()`, `view.erDiagram()`), any ontology compiles deterministically into **W3C SHACL**, **RDFS**, **OWL 2**, **Pydantic v2 classes (`.py`)**, **JSON Schema**, **Frictionless Table Schema**, and **Mermaid ER diagrams**.
4. **Pydantic & SHACL/RDFS-Enforced Extraction:** Document extraction in `services/internal-extractor` uses the generated **Pydantic v2 models** and **JSON Schema** to enforce structured LLM output across OpenAI, Anthropic, Gemini, and Ollama, validates extracted facts against the compiled **RDFS** and **SHACL** shapes, and exports verifiable **W3C `PROV-O`** provenance graphs tied to `ohi.lock.json` SHA-256 digests.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Drop Redundant Ontology SQL Tables (Option 2A):** Consolidate all ontology-internal structure and metadata (`classes`, `attributes`, `relations`, `relation_attributes`, `modules`, `disjointness`, `restrictions`, `notes`, `examples`, `localized_texts`, `languages`, `class_positions`, `module_layout`) into `ontology_documents` (`linkml_yaml`, `ohi_yaml`, `ohi_lockfile`, `ui_layout`, `compiled_artifacts`).
- **Maintain Clean UI Ergonomics via Server DTO Projection (Approach 1):** Project the canonical LinkML AST + `ui_layout` into the existing TypeScript domain interfaces (`OntologyClass`, `OntologyRelation`, `OntologyAttribute`, `OntologyModule`, etc.) using deterministic LinkML symbol keys (`"Person"`, `"works_for"`, `"Person.age"`) so React Flow (`OntologyCanvas`), `CqWorkbench`, and `DetailPanelShell` continue working cleanly without a ground-up UI rewrite.
- **Transactional Cascade Helpers Across External Boundaries:** Migrate the 3 external boundaries (`facts` / `document_entities`, Competency Questions, `dataset_sources`) from UUID foreign keys to LinkML symbol `text` keys, backed by atomic `cascadeSymbolRename` and `cascadeSymbolDelete` helpers.
- **`ohi.dev` Package Manager & Lockfile Verification:** Replace OLS4/LOV/BARTOC/OntoPortal/EU Vocabularies with `ohi.dev` search, inspection, transitive dependency resolution, SHA-256 verification, and `ohi.lock.json` import/export.
- **First-Class SHACL, RDFS, OWL 2, and Pydantic Compilation & Export:** Expose instant preview and export for `.linkml.yaml`, `.shacl.ttl`, `.rdfs.ttl`, `.owl.ttl`, and Pydantic `models.py` in both the Ontology Workbench and the Documents / Knowledge Graph export flow.
- **Pydantic-Guided Document Extraction & `PROV-O` Lineage:** Upgrade `services/internal-extractor` to validate and structure LLM extraction via the ontology's generated Pydantic v2 models + SHACL/RDFS, and emit W3C `PROV-O` provenance triples referencing `ohi.lock.json` SHA-256 digests.

### Non-Goals

- Preserving legacy registry scrapers (`ols4-client.ts`, `lov-client.ts`, `bartoc.ts`, `ontoportal.ts`, `eu-vocabularies.ts`) or the `registry_endpoint_snapshots` diagnostic table.
- Rewriting every React component in `src/features/ontology/components/` to manipulate raw LinkML YAML strings on the client.

### Anti-Goals

- **Dual divergent sources of truth:** Relational tables must never duplicate what is inside `ontology_documents.linkml_yaml`.
- **Unverified third-party ontology imports:** Imported `ohi.dev` artifacts whose SHA-256 digest does not match `ohi.lock.json` must halt sync and surface a tamper/drift error.
- **Direct browser calls to external LLM or catalog APIs:** All `ohi.dev` catalog fetches and LLM calls must execute on the server or in backend microservices per [`docs/agents/architecture.md`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/agents/architecture.md).

---

## 3. Constraints

- **Tech Stack & Tooling (`AGENT_CONTRACT.md`):** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query, React Flow, Drizzle ORM (`1.0.0-rc.4`), PostgreSQL, and `pnpm` (`pnpm@11.2.2`).
- **Route & Component Rules:** Never hardcode routes (always use [`src/lib/routes.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/lib/routes.ts)). Multi-file components follow `components/<component-name>/<component-name>.tsx`. Update `src/features/<feature>/README.md` for every modified feature (`ontology`, `documents`, `tabular`).
- **Browser Shim for `@neverblink/linkml`:** `@neverblink/linkml@0.18.2` references `process.cwd` once at module init; any shared module that could be bundled for the browser must guard `if (typeof process === "undefined") { (globalThis as any).process = { cwd: () => "/" } }`.
- **Workspace Access Control:** Every query and mutation must continue to enforce `group_key` isolation via [`src/server/group-access.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/server/group-access.ts).

---

## 4. Approaches Considered

### Data Model Approaches

1. **Option 1 (LinkML Bridge over Existing Relational Tables):** Keep all 12+ ontology SQL tables and convert to LinkML only at export time. _Rejected because it maintains dual representations and prevents LinkML from being the true source of truth._
2. **Option 2A (Pure LinkML Canonical Store — Selected):** Store `linkml_yaml`, `ohi_yaml`, `ohi_lockfile`, `ui_layout`, and `compiled_artifacts` on `ontology_documents`, drop the 11 ontology-internal relational tables, and use LinkML symbol keys (`text`) across the 3 external boundaries with transactional cascade helpers. _Selected by user for maximum architectural clarity and native LinkML fidelity._
3. **Option 2B (Canonical LinkML + Synchronized Relational Projection):** Keep relational tables as a read-projection synced from LinkML. _Rejected in favor of Option 2A to eliminate redundant tables._

### Runtime Architecture Approaches

1. **Approach 1 (Next.js `@neverblink/linkml` Engine + Server DTO Projection + Artifact Passing to Python — Selected):** Run `@neverblink/linkml` in Next.js for instant compilation (`shacl`, `rdfs`, `owl`, `pydantic`, `jsonSchema`, `erDiagram`, `lint`, `fromOwl`), project clean DTOs to the React UI, and pass pre-compiled `pydantic_py`, `json_schema`, `shacl_ttl`, `rdfs_ttl`, and `ohi_lockfile` to `services/internal-extractor` and `services/reasoner`. _Selected by user._
2. **Approach 2 (Raw LinkML AST in React UI):** Remove DTO projection and rewrite all React components. _Rejected due to unnecessary UI churn._
3. **Approach 3 (Dual-Compiler Runtime in Python Containers):** Re-run `ohi` CLI inside Python containers on every job. _Rejected due to Docker complexity and redundant compilation._

---

## 5. Detailed Technical Design

### 5.1 Database Schema Refactor ([`src/server/db/schema.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/server/db/schema.ts) & Drizzle Migration)

#### Tables Dropped (14 total)

1. `ontology_modules`
2. `ontology_classes`
3. `ontology_attributes`
4. `ontology_relations`
5. `ontology_relation_attributes`
6. `ontology_class_positions`
7. `ontology_module_layout`
8. `ontology_languages`
9. `ontology_notes`
10. `ontology_localized_texts`
11. `ontology_examples`
12. `ontology_class_disjointness`
13. `ontology_class_restrictions`
14. `registry_endpoint_snapshots`

#### Updated `ontology_documents` Table

```ts
export const ontologyDocuments = pgTable("ontology_documents", {
  id: generatedId(),
  name: text("name").notNull(),
  version: text("version").default("1.0.0"),
  source_file: text("source_file"),
  created_at: created_at(),
  default_language: text("default_language").notNull().default("en"),
  usecase: text("usecase").notNull().default(""),
  group_key: text("group_key").notNull().default("shared"),
  // Canonical LinkML + ohi.dev columns:
  linkml_yaml: text("linkml_yaml").notNull().default(""),
  ohi_yaml: text("ohi_yaml").notNull().default(""),
  ohi_lockfile: jsonb("ohi_lockfile")
    .$type<OhiLockfileV2 | null>()
    .default(null),
  ui_layout: jsonb("ui_layout")
    .$type<OntologyUiLayout>()
    .notNull()
    .default(sql`'{"classPositions":{},"moduleLayouts":{}}'::jsonb`),
  compiled_artifacts: jsonb("compiled_artifacts")
    .$type<CompiledOntologyArtifacts | null>()
    .default(null),
})
```

Where:

- `OhiLockfileV2` matches `ohi.lock.json` format v2:
  ```ts
  export interface OhiLockfileV2 {
    lock_version: 2
    selections: Array<{
      ontology: string // e.g. "w3c/dcat@3"
      release_url: string
      artifact_url: string
      format:
        | "owl-turtle"
        | "owl-rdfxml"
        | "rdfs-turtle"
        | "linkml-yaml"
        | "ossie-yaml"
    }>
    files: Array<{
      ontology: string // e.g. "w3c/prov-o@2013"
      base_url: string
      url: string
      path: string // e.g. ".ohi/w3c/prov-o/2013/prov-o.linkml.yaml"
      format:
        | "owl-turtle"
        | "owl-rdfxml"
        | "rdfs-turtle"
        | "linkml-yaml"
        | "ossie-yaml"
      sha256: string
    }>
  }
  ```
- `OntologyUiLayout` stores visual canvas positions and workbench UI metadata that have no direct semantic equivalent in standard LinkML:
  ```ts
  export interface OntologyUiLayout {
    classPositions: Record<string, Record<string, { x: number; y: number }>> // moduleId -> classId -> {x, y}
    moduleLayouts: Record<
      string,
      { x: number; y: number; width: number; height: number }
    >
  }
  ```
- `CompiledOntologyArtifacts` caches deterministic outputs from `@neverblink/linkml`:
  ```ts
  export interface CompiledOntologyArtifacts {
    source_sha256: string
    compiled_at: string
    shacl_ttl: string
    rdfs_ttl: string
    owl_ttl: string
    pydantic_py: string
    json_schema: string
    er_diagram: string
    lint_issues: Array<{
      issue_type: string
      severity: string
      message: string
      element?: string
    }>
  }
  ```

#### Updated `reference_ontologies` Table (Scoped to `ohi.dev` Locked Packages)

- Add `ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, { onDelete: "cascade" })` (nullable for shared cached artifacts), `publication_url: text("publication_url")`, `artifact_url: text("artifact_url")`, `artifact_format: text("artifact_format").notNull().default("linkml-yaml")`, `sha256: text("sha256").notNull().default("")`, `artifact_content: text("artifact_content").notNull().default("")`, and `is_transitive: boolean("is_transitive").notNull().default(false)`.
- `source_registry` defaults to `"ohi"`.
- `reference_ontology_terms` remains intact to store extracted classes/properties and their 384-d `embedding` vectors so local semantic vector alignment (`src/features/ontology/server/services/vector-similarity.ts`) continues working at zero API cost.

#### Updated External Boundary Tables (UUID → Symbolic `text` Keys)

1. **Documents & Extraction (`src/server/db/schema.ts`):**
   - `facts.relation_type_id`: change from `uuid` to `text("relation_type_id")` (stores LinkML slot key, e.g. `"works_for"`).
   - `document_entities.class_id`: change from `uuid` to `text("class_id")` (stores LinkML class key, e.g. `"Person"`).
   - `entity_attribute_values.attribute_id`: change from `uuid` to `text("attribute_id")` (stores `"ClassName.attrName"` or `"attrName"`).
   - `fact_relation_attribute_values.relation_attribute_id`: change from `uuid` to `text("relation_attribute_id")` (stores `"relationName.attrName"`).
   - `extraction_runs`: add `ohi_lockfile_snapshot: jsonb("ohi_lockfile_snapshot").$type<OhiLockfileV2 | null>()` and `ontology_sha256: text("ontology_sha256")` so every extraction run permanently records the exact cryptographic hash of the ontology and its `ohi.lock.json` dependencies.
2. **Competency Questions (`src/server/db/schema.ts`):**
   - `ontology_competency_questions`: change `subject_class_id`, `predicate_relation_id`, `object_class_id`, `subject_example_id`, `predicate_example_id`, `object_example_id` from `uuid` to `text`.
   - `ontology_cq_triples`: drop the foreign key constraints to `ontology_classes` and `ontology_relations`, and change `subject_class_id`, `predicate_relation_id`, `object_class_id`, `subject_example_id`, `predicate_example_id`, `object_example_id` from `uuid` to `text`.
   - `ontology_competency_question_modules`: change `module_id` from `uuid` to `text` (stores LinkML subset/module key).
3. **Tabular Dataset Sources (`dataset_sources`):**
   - `mapping_spec` JSONB already stores `targetClassId: string` and `targetModuleId?: string`, which now hold LinkML symbol keys.

_(Builder call: Keeping `ontology_competency_questions`, `ontology_cq_triples`, and `ontology_defect_suppressions` as SQL tables referencing `ontology_documents.id` avoids rewriting the CQ workbench queries and defect suppression actions while switching their concept references to LinkML symbol strings.)_

---

### 5.2 LinkML Canonical Mapping Convention (`src/features/ontology/server/linkml/`)

To ensure 100% lossless round-trips between the workbench UI and LinkML YAML, we define a strict mapping in `src/features/ontology/server/linkml/ast-mapper.ts`:

| Workbench Concept          | LinkML YAML Representation                                                                                                                                                                                                                                                                                                                                         | ID / Symbol Key Convention                                                                                                                                                                      |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ontology Document**      | Root `SchemaDefinition`: `id` (normalized base IRI), `name`, `description` (`usecase`), `in_language` (`default_language`), `version`, `prefixes`, `imports: ["linkml:types", ...ohiImports]`, `annotations.kg_languages`                                                                                                                                          | `ontology_documents.id` (UUID for the DB document row)                                                                                                                                          |
| **Module**                 | `subsets.<moduleKey>`: `description`, `annotations` (`kg_notes`, `kg_localized_texts`)                                                                                                                                                                                                                                                                             | `moduleKey` (e.g. `"core"`, `"provenance"`)                                                                                                                                                     |
| **Class**                  | `classes.<classKey>`: `description`, `is_a` (`parent_class_id`), `in_subset: [<moduleKey>]`, `disjoint_with: [...]`, `attributes: {...}`, `slot_usage: {...}`, `examples: [...]`, `annotations` (`kg_instance_policy`, `kg_notes`, `kg_localized_texts`, `kg_examples`)                                                                                            | `classKey` (e.g. `"Person"` or `"dcat:Dataset"`)                                                                                                                                                |
| **Class Attribute**        | `classes.<classKey>.attributes.<attrKey>`: `range` (`string`, `integer`, `float`, `boolean`, `date`, `datetime`, `uri`), `required: boolean`, `description`, `annotations` (`kg_notes`, `kg_localized_texts`, `kg_examples`)                                                                                                                                       | Composite key `"<classKey>.<attrKey>"` (so attribute IDs remain globally unique within an ontology document)                                                                                    |
| **Relation (Object Slot)** | Top-level `slots.<relationKey>` (and attached to `classes.<domainClassKey>.slots`): `domain: <domainClassKey>`, `range: <rangeClassKey>`, `inverse: <inverseName>`, `description`, `minimum_cardinality`, `maximum_cardinality`, `annotations` (`kg_cardinality`, `kg_instance_policy`, `kg_relation_attributes`, `kg_notes`, `kg_localized_texts`, `kg_examples`) | `relationKey` ( or `"<domainClassKey>__<relationName>__<rangeClassKey>"` when the same relation name is used between different domain/range pairs, with `slot_uri` preserving the display name) |
| **Relation Attribute**     | Stored in `slots.<relationKey>.annotations.kg_relation_attributes` (and emitted as LinkML association/reification metadata)                                                                                                                                                                                                                                        | Composite key `"<relationKey>.<attrKey>"`                                                                                                                                                       |
| **Class Restriction**      | `classes.<classKey>.slot_usage.<targetSlotOrAttr>`: `minimum_cardinality`, `maximum_cardinality`, `exact_cardinality`                                                                                                                                                                                                                                              | Composite key `"<classKey>:<targetKey>:<restrictionType>"`                                                                                                                                      |

_(Builder call: Using composite string IDs `"<classKey>.<attrKey>"` for attributes and `"<relationKey>.<attrKey>"` for relation attributes guarantees every `OntologyAttribute.id` and `OntologyRelationAttribute.id` expected by the existing UI components and `entity_attribute_values` table is deterministic and collision-free without UUIDs.)_

---

### 5.3 Transactional Symbol Cascade Service (`src/features/ontology/server/linkml/symbol-cascade.ts`)

Whenever a class, relation, attribute, or module is renamed or deleted via a server action—or when a user saves raw LinkML YAML edits—the mutation runs inside `db.transaction(async (tx) => ...)`:

1. **`cascadeSymbolRename(tx, ontologyId, kind, oldKey, newKey)`:**
   - **If `kind === "class"`:**
     - Update `document_entities.class_id = newKey` where `class_id = oldKey` and `extraction_run_id` belongs to `ontologyId`.
     - Update `entity_attribute_values.attribute_id` prefix `"${oldKey}."` → `"${newKey}."`.
     - Update `ontology_competency_questions` and `ontology_cq_triples` (`subject_class_id`, `object_class_id`).
     - Update `dataset_sources.mapping_spec` JSONB (`targetClassId`, `targetClassName`).
   - **If `kind === "relation"`:**
     - Update `facts.relation_type_id = newKey` where `relation_type_id = oldKey` and `extraction_run_id` belongs to `ontologyId`.
     - Update `fact_relation_attribute_values.relation_attribute_id` prefix `"${oldKey}."` → `"${newKey}."`.
     - Update `ontology_competency_questions` and `ontology_cq_triples` (`predicate_relation_id`).
   - **If `kind === "attribute"`:**
     - Update `entity_attribute_values.attribute_id = newKey` where `attribute_id = oldKey`.
   - **If `kind === "module"`:**
     - Update `ontology_competency_question_modules.module_id = newKey` where `module_id = oldKey`.

2. **`cascadeSymbolDelete(tx, ontologyId, kind, deletedKey)`:**
   - Nulls out (`SET ... = NULL`) or deletes the corresponding references across `document_entities`, `facts`, `entity_attribute_values`, `fact_relation_attribute_values`, `ontology_competency_questions`, `ontology_cq_triples`, and `ontology_competency_question_modules` (mirroring the previous PostgreSQL `ON DELETE SET NULL` / `ON DELETE CASCADE` behavior).

---

### 5.4 `@neverblink/linkml` Compiler & Importer Pipeline (`src/features/ontology/server/linkml/compiler.ts`)

1. **Compilation (`compileLinkmlOntology`):**
   - Loads the ontology's `linkml_yaml` alongside any locked dependency schemas from `reference_ontologies.artifact_content` using:
     ```ts
     const { view, report } = LinkML.loadFromString(
       linkmlYaml,
       lockedImports,
       true,
       importMap
     )
     ```
   - Calls `LinkML.lint(view)` and combines any LinkML validation issues with the workbench's OOPS! defect linter.
   - Invokes:
     - `view.shacl({ format: "ttl" })` → `shacl_ttl`
     - `view.rdfs({ format: "ttl" })` → `rdfs_ttl`
     - `view.owl({ format: "ttl" })` → `owl_ttl`
     - `view.pydantic()` → `pydantic_py`
     - `view.jsonSchema()` → `json_schema`
     - `view.erDiagram()` → `er_diagram`
   - Persists `compiled_artifacts` on `ontology_documents`.
2. **Importing OWL / RDFS / LinkML (`importOntologyToLinkml`):**
   - When importing a `.linkml.yaml` file: validates directly with `LinkML.loadFromString`, auto-generates a Dagre `ui_layout` for all classes/subsets, and saves to `ontology_documents`.
   - When importing an OWL/RDFS `.ttl` or `.owl` file: converts to LinkML YAML using `LinkML.fromOwl(turtleDocument)` (falling back to our `n3` parser if a non-standard RDF construct needs pre-normalization), computes the initial `ui_layout`, and saves to `ontology_documents`.

---

### 5.5 `ohi.dev` Package Manager & Lockfile Engine (`src/features/ontology/server/ohi/`)

We replace `src/features/ontology/server/services/vocabulary-registries/` with `src/features/ontology/server/ohi/`:

1. **Curated + Live `ohi.dev` Catalog Client (`catalog-client.ts`):**
   - Supports searching and inspecting packages addressed as `namespace/name[@version]` (e.g., `w3c/dcat@3`, `w3c/prov-o@2013`, `w3c/skos@2009`, `dublincore/dcterms@2020`, `w3c/ssn@2017`, `w3c/org@2014`, `foaf/foaf@0.1`, `schemaorg/schema@28`).
   - Queries the `ohi.dev` catalog API (with resilient fallback to built-in immutable publication descriptors and official W3C/LinkML artifact mirrors when offline or in air-gapped Docker environments so tests and offline dev never fail).
2. **Dependency Resolution & SHA-256 Lockfile (`lockfile-manager.ts`):**
   - `addOhiDependency(ontologyId, packageRef, format = "linkml-yaml")`:
     - Updates `ontology_documents.ohi_yaml`.
     - Resolves the requested publication plus all transitive dependencies (e.g., `w3c/dcat@3` → `dublincore/dcterms`, `w3c/skos`, `w3c/prov-o@2013`).
     - Downloads the artifacts, computes their `crypto.createHash("sha256")` digests, and writes/verifies `ontology_documents.ohi_lockfile` (`OhiLockfileV2`).
     - If an existing locked artifact's SHA-256 does not match the lockfile during `syncOhiDependencies`, throws a `TamperOrDriftError` and surfaces it in the Ontology Issues drawer.
     - Parses terms from the downloaded `linkml-yaml` / `owl-turtle` artifacts into `reference_ontologies` + `reference_ontology_terms` with local 384-d embeddings.
     - Adds the dependency's schema URI to `imports:` in `ontology_documents.linkml_yaml` and recompiles `compiled_artifacts`.
3. **Workspace `.ohi/` Export & Sync:**
   - Users can export or import `ohi.yaml` + `ohi.lock.json` from the Ontology Actions menu, and run `pnpm ohi:sync` locally if they want `.ohi/` materialized on disk.

---

### 5.6 Pydantic + SHACL/RDFS Document Extraction & Provenance (`services/internal-extractor/` & `src/features/documents/`)

1. **Extraction Job Payload (`src/features/documents/server/actions/`):**
   - When an extraction run starts ([`extraction.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/documents/server/actions/extraction.ts) and [`enqueue-extraction-job.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/documents/server/actions/enqueue-extraction-job.ts)), Next.js snapshots `ontology_documents.ohi_lockfile` and `compiled_artifacts.source_sha256` onto `extraction_runs`, and includes in `ExtractionRequest`:
     - `linkml_yaml`: canonical LinkML schema
     - `pydantic_code`: compiled Pydantic v2 `.py` module from `@neverblink/linkml`
     - `json_schema`: compiled JSON Schema from `@neverblink/linkml`
     - `shacl_ttl` & `rdfs_ttl`: compiled W3C SHACL and RDFS Turtle strings
2. **Pydantic-Guided Extractor (`services/internal-extractor/src/internal_extractor/`):**
   - **Dynamic Pydantic Model Loader (`pydantic_loader.py`):**
     - Safely executes the `@neverblink/linkml`-generated `pydantic_code` in a restricted namespace containing only `pydantic`, `typing`, `datetime`, `enum`, and `decimal` (with fallback to building dynamic `pydantic.create_model` classes from the ontology classes/attributes/relations).
     - Wraps the domain Pydantic classes into a structured `ChunkExtractionEnvelope` (`entities: list[TypedEntity]`, `facts: list[TypedFactWithEvidence]`) whose JSON schema incorporates the exact Pydantic field types, descriptions, required constraints, and enum/pattern validators from LinkML.
   - **Multi-Provider Structured LLM Extraction (`kg_builder.py`):**
     - Uses structured output / tool-calling bound to the Pydantic schema across OpenAI, Anthropic, Gemini, and Ollama (with automatic fallback to `neo4j-graphrag` if a custom external model does not support structured schemas).
     - Validates every extracted entity's attributes against the compiled domain Pydantic model before accepting it.
3. **RDFS Entailment, SHACL Validation & W3C `PROV-O` Export:**
   - In-app ([`src/features/ontology/server/shacl/validator.ts`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/ontology/server/shacl/validator.ts)) and in [`services/reasoner`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/services/reasoner/README.md), validation uses the `@neverblink/linkml`-compiled `shacl_ttl` and `rdfs_ttl`.
   - New **Extraction Bundle & Provenance Exporter (`src/features/documents/server/actions/export-extraction-bundle.ts`)**:
     - Exports accepted facts and entities for a document (or entire ontology KG) as:
       1. **`instances.ttl` (with W3C `PROV-O` lineage):** Emits `prov:Activity` for the `extraction_run`, `prov:Entity` for each locked ontology artifact in `ohi_lockfile` (recording `ohi:sha256`, `prov:atLocation` release URL, and format), `prov:used` edges, and `prov:wasGeneratedBy` / `prov:wasDerivedFrom` (linking facts to `evidence_anchors`).
       2. **`ontology.rdfs.ttl` & `shapes.shacl.ttl`:** The exact RDFS and SHACL files compiled from LinkML.
       3. **`models.py` & `instances.json`:** The generated Pydantic v2 classes plus serialized JSON instances that load directly into those Pydantic classes.

---

### 5.7 Workbench UI Additions (`src/features/ontology/components/` & `src/features/documents/components/`)

1. **Ontology Export & Code Compiler Modal (`src/features/ontology/components/export-ontology-dialog/`):**
   - Replaces the separate JSON/OWL/SHACL export dialogs with a unified **LinkML & Code Compiler Studio** modal supporting live preview and 1-click download of:
     - **LinkML YAML (`.linkml.yaml`)**
     - **W3C SHACL Shapes (`.shacl.ttl`)**
     - **RDFS Vocabulary (`.rdfs.ttl`)**
     - **OWL 2 Turtle (`.owl.ttl`)**
     - **Pydantic v2 Models (`models.py`)**
     - **JSON Schema (`.schema.json`) & Mermaid ER (`.mmd`)**
     - **`ohi.yaml` & `ohi.lock.json`**
2. **`ohi.dev` Package Manager Panel (`src/features/ontology/components/standards-browser/`):**
   - Updates the Standards tab in the left browser panel to search `ohi.dev`, display package versions (`w3c/dcat@3`, `w3c/prov-o@2013`, etc.), preview transitive dependencies and SHA-256 lock status, add/remove dependencies from `ohi.yaml`, and run lockfile verification (`Verify Lockfile`).
3. **Documents KG Bundle Export (`src/features/documents/components/document-workspace-header/`):**
   - Adds an **Export KG Bundle (SHACL + RDFS + Pydantic + PROV-O)** action in the Documents workspace header.

---

## 6. What Is Left to the Builder

- Exact YAML formatting options (`lineWidth`, key sorting) when serializing `linkml_yaml` and `ohi_yaml`.
- Visual layout details of the multi-tab code preview inside the unified export modal (using existing shadcn `Tabs`, `Dialog`, and `Badge` primitives).
- Internal chunk-batching concurrency in `services/internal-extractor` when running Pydantic-validated LLM calls.
