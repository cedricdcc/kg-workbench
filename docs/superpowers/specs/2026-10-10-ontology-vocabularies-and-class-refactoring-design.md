# Ontology Vocabularies Ingestion, Proactive Checking & Class Refactoring Design Spec

**Date:** 2026-10-10  
**Status:** In Review  
**Topic:** End-to-end architecture for custom vocabulary ingestion, proactive duplicate and standard term checking, deep ontology alignment analysis, and impact-aware class refactoring with practical OWL rules and visual graph diffs.

---

## 1. Problem Statement & Motivation

As ontologies in KG Workbench grow, knowledge engineers face four core friction points:

1. **Siloed Vocabulary Ingestion**: Reference ontologies can only be pulled from public OLS4 and LOV registry search endpoints. There is no mechanism to import proprietary or localized `.ttl`, `.owl`, or `.rdf` files, and indexed terms drop critical OWL property metadata (`domain`, `range`, and property type).
2. **Passive, Late-Stage Verification**: Duplicate classes, overlapping attributes, and standard vocabulary matches are only discovered if a user manually inspects a class card. During authoring (typing in dialogs, canvas, or detail headers), there is zero real-time assistance or collision prevention.
3. **Lack of Whole-Ontology Strategic Auditing**: There is no high-level analytical job to evaluate the ontology as a whole, identify redundant concepts across modules, assess overall standard alignment, or recommend which external ontologies should be imported to standardize the workspace.
4. **Fragile Class Evolution & Opaque Graph Impact**: Modifying a class (reparenting, renaming, merging) currently lacks safety guardrails:
   - No cycle detection for `rdfs:subClassOf` ($A \subset B \subset A$).
   - Inherited attributes and relations are invisible, leading to accidental duplicate property definitions.
   - Changing a class's hierarchy or semantics can break relations where it acts as `domain` or `range`, and impacts downstream extracted document facts.
   - Users cannot see a visual diff of what changing a class will do to the overall graph structure.

---

## 2. Goals & Non-Goals

### Goals

- **Self-Contained Custom Vocabulary Ingestion**: Support drag-and-drop upload and direct URL ingestion for `.ttl`, `.owl`, `.rdf`, and `.jsonld` files using a pure TypeScript parser (`n3` / XML parser) in Next.js, indexing `domain_iris`, `range_iris`, and property kinds (`datatype` vs `object`).
- **Contextual Property Suggestions**: Contextually recommend standard datatype properties when adding attributes, and standard object properties (with matching domain and range) when authoring relations.
- **Ambient Proactive Assistance (Tier 1)**: Instant (0ms local) typing assist in class, attribute, and relation inputs detecting exact/fuzzy internal duplicates, cyclical parent selections, and instant standard autocomplete.
- **Deep Full-Ontology Alignment Analysis (Tier 2)**: An on-demand analytical audit generating an interactive report with internal redundancy clustering, external standard alignment scores, and ranked 1-click external vocabulary recommendations.
- **Impact-Aware Refactor Class Studio**: A guided modal with three modes:
  - _Reparent / Move Hierarchy_: Live cycle guard, visual inheritance diff, and attribute collision resolution.
  - _Adopt Standard Term_: Comprehensive reconciliation of attributes and AI-assisted relation remapping.
  - _Merge Classes_: Reassigns relations, combines attributes, and atomically updates extracted database facts and entities.
- **Practical OWL Restrictions & Modeling**:
  - `owl:disjointWith` multi-class constraints.
  - Cardinality restrictions (`min`, `max`, `exact`) on class relations and attributes.
  - Visual inheritance badges in `ClassDetail`.
  - Full OWL RDF/XML export support for disjointness and cardinality axioms.
- **Visual Graph Structural Diff**: React Flow neighborhood preview rendering additions (green solid), deletions (red dashed), and modifications (amber/blue) before refactor commits.

### Non-Goals

- Full First-Order Logic or OWL 2 DL classification reasoning (e.g. Pellet/HermiT)—we target practical structural consistency and standards compliance.
- Unattended background auto-merging of user ontologies without human approval.

---

## 3. High-Level Architecture & Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. VOCABULARY INGESTION                               │
│  [Upload .ttl/.owl File or URL] ➔ Next.js pure TS parser (n3)                   │
│  Extract: Classes, Properties, rdfs:domain, rdfs:range, rdfs:subClassOf         │
│  Persist: reference_ontologies & reference_ontology_terms (with 384-d vectors)   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       2. PROACTIVE CHECKING ENGINE                              │
│                                                                                 │
│  [Tier 1: Ambient Inline Typing Assist]                                          │
│  - 0ms keystroke assist: detects internal collisions & standard CURIE matches   │
│  - Contextual domain/range property matching                                    │
│                                                                                 │
│  [Tier 2: Deep Full-Ontology Analysis Report]                                   │
│  - Scans full ontology graph across all modules                                 │
│  - Semantic clustering of internal variants (e.g., 'Measurement' vs 'Obs')       │
│  - Recommends external ontologies to import (e.g. SOSA covers 8 classes)        │
│  - 1-click import & batch adoption recommendations                              │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    3. IMPACT-AWARE REFACTOR CLASS STUDIO                        │
│                                                                                 │
│  Modes: [ Reparent Hierarchy ] [ Adopt Standard Term ] [ Merge Classes ]        │
│                                                                                 │
│  Safety & Verification:                                                         │
│  - Live Acyclic DAG Check: validateHierarchyAcyclicity (prevents cycles)       │
│  - Inheritance Diff: gained/lost attributes & relations                         │
│  - Visual Graph Diff Preview: React Flow neighborhood (+ green / - red dashed)  │
│  - Practical OWL: disjointWith & cardinality restriction editor                 │
│                                                                                 │
│  Execution: Atomic PostgreSQL transaction revalidating Next.js cache            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 Custom Vocabulary Ingestion Engine

- **File Upload & Streaming Parser**:
  - Located under `src/features/ontology/server/services/vocabulary-ingestion/`.
  - Supports Turtle syntax via `n3.Parser` and RDF/XML via a lightweight XML SAX/DOM extractor.
  - Extracts prefixes, base IRI, `owl:Ontology` header annotations.
  - Terms extracted:
    - `owl:Class` / `rdfs:Class`
    - `owl:DatatypeProperty` ➔ `property_kind = 'datatype'`
    - `owl:ObjectProperty` ➔ `property_kind = 'object'`
    - Annotations: `rdfs:label`, `rdfs:comment`, `skos:prefLabel`, `skos:altLabel`.
    - Axioms: `rdfs:subClassOf`, `rdfs:domain`, `rdfs:range`.
  - Computes 384-dimensional embeddings in batches via `local-embedder.ts`.
- **UI Entry Point**:
  - In `reference-vocabularies-dialog.tsx`, add tab `"Import File / URL"`.
  - File dropzone supporting `.ttl`, `.owl`, `.rdf`, `.jsonld`.
  - URL input for fetching public ontologies directly into the reference registry.

### 4.2 Proactive Checking & Ambient Assist (Tier 1)

- **Hook `useOntologyAssist`**:
  - Accepts active `ontologyId`, `currentModuleId`, field type (`class` | `attribute` | `relation`), and typed input string.
  - Runs debounced (150ms) client-side match:
    1. **Internal collision check**: Case-insensitive and stem matching against existing items in the ontology document.
    2. **Parent cycle pre-check**: Checks `parentClassId` against descendants using local memoized graph structure.
    3. **Reference vocabulary suggestion**: Queries indexed reference terms.
- **Component `SmartAssistChip`**:
  - Displays non-intrusively beneath text inputs:
    - ⚠️ _"Class 'Sensor' already exists in module 'Hardware'"_
    - 💡 _"Standard match: sosa:Sensor (SOSA) [Adopt] [Set as Subclass]"_
    - 💡 _"Standard property: qudt:numericValue (QUDT) [Use Property]"_

### 4.3 Deep Full-Ontology Analysis & Alignment Report (Tier 2)

- **Server Action `runFullOntologyAnalysis(ontologyId)`**:
  - Retrieves all classes, attributes, relations, and modules for the active document.
  - Computes similarity matrices:
    - **Intra-Ontology Variant Matrix**: Clusters classes across modules with semantic similarity > 0.82 or matching tokens.
    - **Cross-Vocabulary Alignment Matrix**: Evaluates all classes against installed reference terms; queries public LOV/OLS4 APIs for unmapped clusters.
    - **Strategic Vocabulary Gap Analysis**: Groups unmapped classes by domain keywords (e.g. "sensor", "unit", "spatial", "biology") and matches against known top-tier ontologies (SOSA, SSN, QUDT, ENVO, GEO, PROV-O, Schema.org).
- **Report Component `OntologyAnalysisReportDialog`**:
  - Accessible via the ontology header and health status pill.
  - Tabs:
    1. **Executive Summary**: Health score (0–100%), % standardized classes, detected issues (cycles, orphans, duplicates).
    2. **Recommended Vocabularies**: Cards for recommended external ontologies with coverage counts and 1-click **[Import & Index]**.
    3. **Class Alignment Matrix**: List of classes with side-by-side standard matches and **[Adopt Term]** / **[Subclass]** actions.
    4. **Duplicate & Merge Candidates**: Groups of redundant internal classes with 1-click **[Open Merge Studio]**.

### 4.4 Impact-Aware Refactor Class Studio

- **Modal Component `RefactorClassDialog`**:
  - Triggered from `ClassDetailHeader` and from the Analysis Report.
  - Header displays current class identity, module, and parent.
  - Mode selector:
    - **Tab 1: Reparent / Hierarchy (`rdfs:subClassOf`)**:
      - Select new parent class with cycle protection.
      - **Inheritance Diff Table**:
        - Gained attributes & relations (green badge).
        - Lost attributes & relations (red badge).
        - Collision resolution: If parent has attribute `x` and child has attribute `x`, user chooses: _"Drop local duplicate (inherit from parent)"_ or _"Keep specialized local attribute"_.
    - **Tab 2: Adopt Standard Term**:
      - Integrated with full-screen 3-column reconciliation engine: in-place rename, attribute checklist, AI-assisted relation remappings.
    - **Tab 3: Merge Classes**:
      - Select destination class.
      - Review merged attributes and re-routed incoming/outgoing relations.
      - Migration of database facts and document entities.
  - **Visual Graph Diff Preview Panel**:
    - Embedded React Flow canvas rendering affected subgraph.
    - Old edges shown dashed in red (`-`), new edges solid in green (`+`), modified nodes highlighted in blue/amber.
  - **Atomic Persistence**:
    - Server Action `refactorClassHierarchy`, `mergeClasses`, or `reconcileAndAdoptClass` inside a single PostgreSQL transaction.

### 4.5 Practical OWL Restrictions & Disjointness

- **Visual Inheritance in `ClassDetail`**:
  - In `Attributes` tab: Direct attributes listed first; inherited attributes displayed with muted styling and an `Inherited from <ClassName>` badge.
  - In `Relations` tab: Direct relations plus inherited domain/range relations.
- **Disjointness (`owl:disjointWith`)**:
  - Multi-select in `ClassDetail` General tab allowing users to declare disjoint classes.
  - Enforced in `validateHierarchyAcyclicity` (a class cannot be a subclass of a class it is disjoint with).
- **Cardinality Restrictions**:
  - Card in `ClassDetail` (Relations/Attributes) to define cardinality rules:
    - Min Cardinality ($\ge n$)
    - Max Cardinality ($\le n$)
    - Exact Cardinality ($= n$)
- **OWL RDF/XML Exporter Updates**:
  - `classes.ts` in `owl-builder/`: exports `<owl:disjointWith>` elements.
  - Generates `<owl:Restriction>` anonymous superclasses for cardinality rules.

---

## 5. Database Schema Extensions

### 5.1 Updated `reference_ontology_terms`

```typescript
// src/server/db/schema.ts
export const referenceOntologyTerms = pgTable("reference_ontology_terms", {
  id: generatedId(),
  reference_ontology_id: uuid("reference_ontology_id")
    .notNull()
    .references(() => referenceOntologies.id, { onDelete: "cascade" }),
  curie: text("curie").notNull(),
  iri: text("iri").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(), // 'class' | 'property' | 'individual'
  property_kind: text("property_kind"), // 'datatype' | 'object' | null
  description: text("description").notNull().default(""),
  synonyms: text("synonyms")
    .array()
    .default(sql`'{}'::text[]`),
  parent_iris: text("parent_iris")
    .array()
    .default(sql`'{}'::text[]`),
  domain_iris: text("domain_iris")
    .array()
    .default(sql`'{}'::text[]`),
  range_iris: text("range_iris")
    .array()
    .default(sql`'{}'::text[]`),
  related_property_iris: text("related_property_iris")
    .array()
    .default(sql`'{}'::text[]`),
  embedding: real("embedding").array(),
  group_key: text("group_key").notNull().default("shared"),
})
```

### 5.2 New `ontology_class_disjointness`

```typescript
export const ontologyClassDisjointness = pgTable(
  "ontology_class_disjointness",
  {
    ontology_id: uuid("ontology_id").notNull(),
    class_id: uuid("class_id")
      .notNull()
      .references(() => ontologyClasses.id, { onDelete: "cascade" }),
    disjoint_class_id: uuid("disjoint_class_id")
      .notNull()
      .references(() => ontologyClasses.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.class_id, table.disjoint_class_id] }),
  ]
)
```

### 5.3 New `ontology_class_restrictions`

```typescript
export const ontologyClassRestrictions = pgTable(
  "ontology_class_restrictions",
  {
    id: generatedId(),
    ontology_id: uuid("ontology_id").notNull(),
    class_id: uuid("class_id")
      .notNull()
      .references(() => ontologyClasses.id, { onDelete: "cascade" }),
    relation_id: uuid("relation_id").references(() => ontologyRelations.id, {
      onDelete: "cascade",
    }),
    attribute_id: uuid("attribute_id").references(() => ontologyAttributes.id, {
      onDelete: "cascade",
    }),
    restriction_type: text("restriction_type").notNull(), // 'min_cardinality' | 'max_cardinality' | 'exact_cardinality'
    cardinality_value: integer("cardinality_value").notNull().default(1),
    created_at: created_at(),
  }
)
```

---

## 6. Server Actions & API Design

1. `importReferenceOntologyFile(input: { fileName: string; content: string; format: 'turtle' | 'rdfxml' | 'jsonld' })`
2. `runFullOntologyAnalysis(ontologyId: string): Promise<OntologyAnalysisResult>`
3. `validateHierarchyAcyclicity(ontologyId: string, classId: string, targetParentClassId: string): Promise<{ valid: boolean; cyclePath?: string[] }>`
4. `refactorClassHierarchy(input: ReparentClassInput): Promise<{ classId: string; droppedAttributes: number }>`
5. `mergeClasses(input: MergeClassesInput): Promise<{ targetClassId: string; migratedRelations: number; migratedFacts: number }>`
6. `updateClassRestrictions(input: UpdateRestrictionsInput): Promise<void>`
7. `updateClassDisjointness(input: UpdateDisjointnessInput): Promise<void>`

---

## 7. Testing & Verification Plan

1. **Unit Tests**:
   - `tests/vocabulary-ingestion.test.ts`: Verify `.ttl` and `.owl` parsing with `n3`, testing class and property extraction, `domain`/`range` capture, and prefix resolution.
   - `tests/hierarchy-acyclicity.test.ts`: Test cycle detection algorithms for 2-node ($A \to B \to A$), 3-node ($A \to B \to C \to A$), and complex multi-parent graphs.
   - `tests/class-refactoring.test.ts`: Test `refactorClassHierarchy` and `mergeClasses` transactions, verifying database facts and relations migration without orphan rows.
2. **Integration Verification**:
   - Verify OWL export produces valid W3C RDF/XML with `<owl:disjointWith>` and `<owl:Restriction>` blocks.
   - End-to-end check of the Deep Analysis Report on seeded ontologies, verifying vocabulary suggestions and alignment metrics.
   - TypeScript compile (`pnpm typecheck`), ESLint (`pnpm lint`), and test suite (`pnpm test`).
