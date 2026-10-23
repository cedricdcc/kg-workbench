# AI Multi-Triple Competency Question Alignment & Registry Discovery Design

- **Date:** 2026-10-23
- **Status:** Approved
- **Scope:** Architectural Subsystem

---

## 1. Overview & Problem Statement

Competency Questions (CQs) represent the functional requirements of an ontology, defining the exact domain queries the knowledge graph must be capable of answering.

In the current implementation of KG Workbench:

1. **Single-Triple Constraint**: A Competency Question can only be bound to a single triple (`subject_class_id`, `predicate_relation_id`, `object_class_id`). In reality, complex domain questions require multi-hop relational paths (e.g. `[WeatherStation] -hasSensor-> [Sensor]` followed by `[Sensor] -measures-> [ObservableProperty]`).
2. **Disconnected Vocabulary Discovery**: When generating an ontology draft from CQs, the system only matches against reference vocabularies that have already been imported locally into the database. It does not actively search external registries (OLS4, LOV, BARTOC, BioPortal) to suggest missing domain vocabularies.
3. **Lack of Human-in-the-Loop Standard Selection**: The user has no checkpoint to inspect which standard ontologies could serve their domain before the LLM begins guessing alignments.
4. **Data Model Clarity**: Users need explicit guidance showing that this AI draft process produces a formal, functioning OWL ontology that becomes the foundational schema for fact extraction.

This specification redesigns the AI generation workflow and data model to:

- Support **multi-triple graph patterns** per Competency Question via a normalized relational table (`ontology_cq_triples`).
- Introduce a **two-phase guided generation wizard** with an explanatory stepper and a **human-in-the-loop vocabulary checkpoint** querying live registries.
- Ground the LLM's schema synthesis in both confirmed external standards and multi-hop graph patterns.
- Ensure the resulting schema is a formal, functioning OWL ontology serving as the knowledge graph's data model.

---

## 2. Architecture & Data Model

### 2.1 Relational Schema: `ontology_cq_triples`

In `src/server/db/schema.ts`, a new table models ordered triples for each CQ:

```typescript
export const ontologyCqTriples = pgTable(
  "ontology_cq_triples",
  {
    id: generatedId(),
    cq_id: uuid("cq_id")
      .notNull()
      .references(() => ontologyCompetencyQuestions.id, {
        onDelete: "cascade",
      }),
    sort_order: integer("sort_order").notNull().default(0),
    subject_class_id: uuid("subject_class_id").references(
      () => ontologyClasses.id,
      { onDelete: "set null" }
    ),
    predicate_relation_id: uuid("predicate_relation_id").references(
      () => ontologyRelations.id,
      { onDelete: "set null" }
    ),
    object_class_id: uuid("object_class_id").references(
      () => ontologyClasses.id,
      { onDelete: "set null" }
    ),
    subject_example_id: uuid("subject_example_id").references(
      () => ontologyExamples.id,
      { onDelete: "set null" }
    ),
    predicate_example_id: uuid("predicate_example_id").references(
      () => ontologyExamples.id,
      { onDelete: "set null" }
    ),
    object_example_id: uuid("object_example_id").references(
      () => ontologyExamples.id,
      { onDelete: "set null" }
    ),
    created_at: created_at().notNull(),
  },
  (table) => [index("idx_cq_triples_cq_id").on(table.cq_id)]
)
```

### 2.2 Migration & Data Backfill Strategy

1. A new migration script creates the `ontology_cq_triples` table.
2. For all existing records in `ontology_competency_questions` where at least one of `subject_class_id`, `predicate_relation_id`, or `object_class_id` is set, a row is inserted into `ontology_cq_triples` with `sort_order = 0`.
3. The legacy single-triple columns on `ontology_competency_questions` remain as nullable fields during backward compatibility, while queries and mutations transition to `ontology_cq_triples`.

### 2.3 Query & Coverage Engine Updates

- In `src/features/ontology/server/queries/competency-questions.ts`, `getOntologyCQs` eagerly joins and groups `triples: OntologyCqTriple[]` ordered by `sort_order ASC`.
- In `src/features/ontology/utils/cq-coverage.ts`:
  - **`full` (Covered)**: CQ has `triples.length >= 1`, and every triple has non-null `subject_class_id`, `predicate_relation_id`, and `object_class_id` pointing to existing classes and relations in the ontology.
  - **`partial`**: CQ has at least one partially or fully mapped triple, but some hops are incomplete or unbound.
  - **`unmapped`**: CQ has 0 triples or no bound classes/relations.

---

## 3. External Registry Discovery & Vocabulary Checkpoint

### 3.1 Domain Concept Extraction & Registry Search

Located in `src/features/ontology/server/services/vocabulary-registries/`:

1. **Keyword Extraction**: Extracts domain noun phrases and relationship keywords from the ontology description and Competency Questions (e.g. `"weather station"`, `"sensor"`, `"observation"`, `"temperature"`).
2. **Active vs. Missing Diffing**:
   - Queries locally registered ontologies from `reference_ontologies`.
   - Queries enabled registry providers (OLS4, LOV, BARTOC, BioPortal, etc.) using `searchRegistries(query)`.
   - Categorizes findings into:
     - `already_imported`: Reference ontology is already present in the workspace.
     - `needs_import`: Candidate external ontology found in registries with relevance rationale (e.g., SOSA, QUDT, GeoSPARQL) that is not yet active locally.

### 3.2 Human-in-the-Loop Vocabulary Checkpoint

Before generating classes or CQ mappings:

- The UI displays discovered candidate vocabularies alongside already active ones.
- The user reviews descriptions, prefix, and source registry, selecting which vocabularies to import.
- Confirmed missing vocabularies are automatically registered and synced into `reference_ontologies` and `reference_ontology_terms`, populating local term embeddings for LLM prompt augmentation.

---

## 4. Multi-Triple Schema Synthesis & LLM Architecture

### 4.1 Zod Draft Schema

In `src/features/ontology/schemas/ai-generation.ts`:

```typescript
export const GeneratedCQTripleSchema = z.object({
  subjectClassName: z.string().trim().min(1),
  predicateRelationName: z.string().trim().min(1),
  objectClassName: z.string().trim().min(1),
})

export const GeneratedCQMappingSchema = z.object({
  cqId: z.string().uuid(),
  moduleNames: z.array(z.string().trim()).default([]),
  triples: z.array(GeneratedCQTripleSchema).min(1),
})

export const GeneratedOntologyDraftSchema = z.object({
  modules: z.array(GeneratedModuleSchema),
  classes: z.array(GeneratedClassSchema),
  relations: z.array(GeneratedRelationSchema),
  cqMappings: z.array(GeneratedCQMappingSchema),
  suggestedContext: z.array(ContextualConnectionSchema).default([]),
})
```

### 4.2 Prompt Engineering (`prompt-builder.ts`)

The prompt instructs the LLM to:

1. Deconstruct each Competency Question into an ordered sequence of connected triples (`[A] -> [rel1] -> [B] -> [rel2] -> [C]`).
2. Maintain path continuity where consecutive hops share the intermediate class entity.
3. Explicitly declare every referenced class and relation in the main `classes` and `relations` sections of the draft.
4. Align classes and relations to terms from the confirmed reference ontologies using `alignment: { mode, targetCurie, targetIri, rationale }`.

### 4.3 Auto-Healing & Graph Consistency

In `src/features/ontology/server/services/ai-ontology-generator/auto-healer.ts`:

- Synthesizes any missing domain classes or relations referenced in CQ triples into the primary module.
- Normalizes class and relation casing to prevent disjoint node references.

### 4.4 Formal OWL Ontology Data Model

The synthesized schema forms a valid OWL 2 ontology:

- Classes map to `owl:Class`.
- Relations map to `owl:ObjectProperty` with domain and range class constraints.
- Vocabulary alignments map to `rdfs:subClassOf` and `owl:equivalentClass`.
- Serves as the authoritative schema for document fact extraction runs.

---

## 5. UI & Guided Generation Wizard

### 5.1 Explanatory UX & Stepper

Located in `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/`:

- **Context Header**:
  > _"Synthesize Knowledge Graph Schema from Competency Questions — Transforms your Competency Questions into a formal, functioning OWL ontology. The resulting classes, relations, and standard vocabulary alignments establish the foundational data model used by the platform to extract and validate facts."_
- **3-Step Stepper**:
  1. `1. Discover & Select Standards` (Human-in-the-loop vocabulary review)
  2. `2. Synthesize Graph Patterns` (LLM multi-hop reasoning & schema generation)
  3. `3. Staged Review & OWL Preview` (Interactive review of multi-triple chains and OWL model)

### 5.2 CQ Workbench Graph Pattern View

Inside `src/features/ontology/components/cq-workbench/`:

- Multi-hop CQ graph pattern visualized as a connected chip sequence:
  `[WeatherStation] ──hasSensor──► [Sensor] ──measures──► [ObservableProperty]`
- The CQ Detail Panel allows adding, editing, reordering, or removing individual triple hops.

---

## 6. Verification & Testing Strategy

1. **Unit Tests**:
   - `tests/ai-cq-multi-triple-schema.test.ts`: Zod validation for multi-triple CQ mappings.
   - `tests/ai-auto-healer-multi-triple.test.ts`: Auto-healing of undeclared classes/relations in CQ paths.
   - `tests/cq-coverage-multi-triple.test.ts`: Accurate coverage evaluation across multi-hop paths.
   - `tests/registry-discovery-diff.test.ts`: Keyword extraction and classification of active vs. missing vocabularies.
2. **Integration Tests**:
   - Transactional persistence in `applyOntologyDraft` verifying atomic insertion into `ontology_cq_triples`.
   - Migration test verifying existing single-triple CQs are properly migrated into `ontology_cq_triples`.
   - OWL export builder test verifying OWL 2 compliance and syntax serialization.
3. **Static Analysis & Build**:
   - `pnpm check` (`pnpm lint && pnpm typecheck && pnpm test && pnpm build`).
