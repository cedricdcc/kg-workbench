# Ontology Vocabularies Ingestion, Proactive Checking & Class Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build custom vocabulary file ingestion (.ttl/.owl), proactive typing collision & standard term assist, full-ontology strategic alignment analysis, and an impact-aware Class Refactor Studio with practical OWL axioms and visual graph diffs.

**Architecture:**

- Ingestion runs in Next.js Server Actions using a pure TypeScript parser (`n3` & streaming XML) to extract terms and property `domain`/`range` axioms into PostgreSQL with local embeddings.
- Proactive ambient checking provides instant (0ms) keystroke assist for duplicate prevention and standard autocomplete.
- Deep ontology analysis audits the entire document graph, clusters internal variants, and ranks external vocabularies for 1-click import.
- Class refactoring provides a 3-mode studio (Reparent, Adopt, Merge) with an acyclic hierarchy validator, inheritance diffs, and React Flow visual graph diff previews.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Drizzle ORM, PostgreSQL (via Docker Supabase), TanStack Query, `@xyflow/react`, `n3`, `fast-xml-parser`, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-10-10-ontology-vocabularies-and-class-refactoring-design.md`](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-10-ontology-vocabularies-and-class-refactoring-design.md)

## Global Constraints

- Never alter an existing class UUID during reparenting or standard adoption; transform the entity in-place to protect `class_positions` canvas layout, translations, and CQ references.
- All refactoring mutations (`refactorClassHierarchy`, `mergeClasses`, `reconcileAndAdoptClass`) must execute atomically within a single `db.transaction`.
- Subclass hierarchies (`rdfs:subClassOf`) must remain strictly acyclic (DAG); commits that introduce circular references must be rejected at both client and server layers.
- Ingestion of custom RDF/OWL files must run completely self-contained in Next.js with pure TypeScript without requiring additional external container services.
- Ambient typing assist (Tier 1) must never trigger blocking server network requests on every keystroke; use debounced local document caches and indexed term lookups.
- Commit all task changes with descriptive commit messages.

## Review Focus

1. **Circular Hierarchy Guard**: Setting class $A$'s parent to class $B$ when $B$ is already an indirect descendant of $A$ ($A \to B \to C \to A$) must be rejected with the exact cycle path.
2. **Duplicate Attribute Handling on Reparenting**: When reparenting a class under a superclass that shares an attribute name, the user must be prompted to either drop the redundant child attribute or keep it as an explicit override.
3. **Class Merge Data Integrity**: Merging class $A$ into class $B$ must re-route all incoming and outgoing relations to $B$, migrate extracted `facts` and `document_entities`, and cleanly delete $A$ without orphaned records.
4. **Custom Turtle & RDF/XML Parsing**: Ingesting real-world `.ttl` and `.owl` files with mixed prefixes and blank nodes must correctly categorize `owl:DatatypeProperty` vs `owl:ObjectProperty` and capture `rdfs:domain` and `rdfs:range`.
5. **Visual Graph Diff Clarity**: The neighborhood preview must clearly differentiate added links (green solid line with `+`), removed links (red dashed line with `-`), and remapped nodes without disrupting canvas state.

---

### Task 1: Database Schema Extensions for OWL Restrictions & Property Domains

**Files:**

- Modify: `src/server/db/schema.ts`
- Create: `drizzle/baseline/0010_owl_restrictions_and_domains.sql`
- Test: `tests/schema-owl-restrictions.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  // Schema additions in src/server/db/schema.ts
  export const referenceOntologyTerms: ... // with property_kind, domain_iris, range_iris
  export const ontologyClassDisjointness: PgTableWithColumns<{
    ontology_id: string;
    class_id: string;
    disjoint_class_id: string;
  }>
  export const ontologyClassRestrictions: PgTableWithColumns<{
    id: string;
    ontology_id: string;
    class_id: string;
    relation_id: string | null;
    attribute_id: string | null;
    restriction_type: 'min_cardinality' | 'max_cardinality' | 'exact_cardinality';
    cardinality_value: number;
  }>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/schema-owl-restrictions.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  referenceOntologyTerms,
  ontologyClassDisjointness,
  ontologyClassRestrictions,
} from "../src/server/db/schema"

test("referenceOntologyTerms includes property_kind, domain_iris, and range_iris columns", () => {
  assert.ok("property_kind" in referenceOntologyTerms)
  assert.ok("domain_iris" in referenceOntologyTerms)
  assert.ok("range_iris" in referenceOntologyTerms)
})

test("ontologyClassDisjointness and ontologyClassRestrictions tables exist", () => {
  assert.ok(ontologyClassDisjointness)
  assert.ok(ontologyClassRestrictions)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/schema-owl-restrictions.test.ts`  
Expected: FAIL with missing properties/tables

- [ ] **Step 3: Implement schema additions in `src/server/db/schema.ts` and create SQL migration**

Add `property_kind`, `domain_iris`, `range_iris` to `referenceOntologyTerms`, and export `ontologyClassDisjointness` and `ontologyClassRestrictions`. Add SQL migration in `drizzle/baseline/0010_owl_restrictions_and_domains.sql`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/schema-owl-restrictions.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/baseline/0010_owl_restrictions_and_domains.sql tests/schema-owl-restrictions.test.ts
git commit -m "feat(schema): add property domain/range columns and OWL restrictions tables"
```

---

### Task 2: Custom Vocabulary Ingestion Engine (Turtle & RDF/XML)

**Files:**

- Create: `src/features/ontology/server/services/vocabulary-ingestion/rdf-parser.ts`
- Modify: `src/features/ontology/server/actions/reference-vocabularies.ts`
- Modify: `src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/vocabulary-upload-tab.tsx`
- Test: `tests/vocabulary-ingestion.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface ParsedOntologyFile {
    prefix: string
    name: string
    baseIri: string
    terms: Array<{
      curie: string
      iri: string
      label: string
      type: "class" | "property" | "individual"
      propertyKind?: "datatype" | "object"
      description: string
      synonyms: string[]
      parentIris: string[]
      domainIris: string[]
      rangeIris: string[]
    }>
  }
  export function parseRdfTurtle(content: string): ParsedOntologyFile
  export function parseRdfXml(content: string): ParsedOntologyFile
  export async function importReferenceOntologyFile(input: {
    fileName: string
    content: string
    format: "turtle" | "rdfxml"
  }): Promise<{ id: string; prefix: string; termsSynced: number }>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/vocabulary-ingestion.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseRdfTurtle } from "../src/features/ontology/server/services/vocabulary-ingestion/rdf-parser"

test("parseRdfTurtle parses classes and properties with domain and range", () => {
  const ttl = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/sensor#> .

    <http://example.org/sensor> a owl:Ontology ;
      rdfs:label "Sensor Vocabulary" .

    ex:Sensor a owl:Class ;
      rdfs:label "Sensor" ;
      rdfs:comment "A sensor device." .

    ex:observes a owl:ObjectProperty ;
      rdfs:label "observes" ;
      rdfs:domain ex:Sensor ;
      rdfs:range ex:Property .

    ex:batteryLevel a owl:DatatypeProperty ;
      rdfs:label "batteryLevel" ;
      rdfs:domain ex:Sensor .
  `
  const result = parseRdfTurtle(ttl)
  assert.equal(result.prefix, "sensor")
  assert.equal(result.terms.length, 3)

  const sensor = result.terms.find((t) => t.label === "Sensor")
  assert.ok(sensor)
  assert.equal(sensor.type, "class")

  const prop = result.terms.find((t) => t.label === "observes")
  assert.ok(prop)
  assert.equal(prop.type, "property")
  assert.equal(prop.propertyKind, "object")
  assert.ok(prop.domainIris.includes("http://example.org/sensor#Sensor"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/vocabulary-ingestion.test.ts`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement `rdf-parser.ts`, server action, and `vocabulary-upload-tab.tsx`**

Implement `parseRdfTurtle` using `n3` and `parseRdfXml` using `fast-xml-parser`. Connect `importReferenceOntologyFile` in `reference-vocabularies.ts` to compute embeddings via `local-embedder.ts` and persist records. Add the "Upload File / URL" tab into `reference-vocabularies-dialog.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/vocabulary-ingestion.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/vocabulary-ingestion/ src/features/ontology/server/actions/reference-vocabularies.ts src/features/ontology/components/reference-vocabularies-dialog/ tests/vocabulary-ingestion.test.ts
git commit -m "feat(ontology): implement custom Turtle and RDF/XML vocabulary ingestion with domain/range indexing"
```

---

### Task 3: Hierarchy Cycle Validation, Visual Inheritance & OWL Axiom Export

**Files:**

- Create: `src/features/ontology/utils/hierarchy-validation.ts`
- Modify: `src/features/ontology/components/class-detail/class-detail.tsx`
- Modify: `src/features/ontology/components/class-detail/attribute-table/attribute-table.tsx`
- Modify: `src/features/ontology/components/class-detail/class-detail-relations.tsx`
- Modify: `src/features/ontology/server/owl-export/owl-builder/classes.ts`
- Test: `tests/hierarchy-validation.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export function validateHierarchyAcyclicity(
    classId: string,
    targetParentClassId: string | null,
    allClasses: Array<{ id: string; parent_class_id?: string | null }>
  ): { valid: boolean; cyclePath?: string[] }

  export function computeInheritedAttributesAndRelations(
    classId: string,
    allClasses: OntologyClassWithAttributes[],
    allRelations: OntologyRelation[]
  ): {
    inheritedAttributes: Array<
      OntologyAttribute & { inheritedFromClassName: string }
    >
    inheritedRelations: Array<
      OntologyRelation & { inheritedFromClassName: string }
    >
  }
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/hierarchy-validation.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { validateHierarchyAcyclicity } from "../src/features/ontology/utils/hierarchy-validation"

test("validateHierarchyAcyclicity detects direct and transitive cycles", () => {
  const classes = [
    { id: "A", parent_class_id: null },
    { id: "B", parent_class_id: "A" },
    { id: "C", parent_class_id: "B" },
  ]

  // Valid: C parent remains B
  assert.equal(validateHierarchyAcyclicity("C", "B", classes).valid, true)

  // Invalid: Setting A parent to C creates A -> C -> B -> A cycle
  const invalid = validateHierarchyAcyclicity("A", "C", classes)
  assert.equal(invalid.valid, false)
  assert.deepEqual(invalid.cyclePath, ["A", "C", "B", "A"])

  // Invalid: Self-parenting
  assert.equal(validateHierarchyAcyclicity("A", "A", classes).valid, false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/hierarchy-validation.test.ts`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement hierarchy validation, visual inheritance badges, and OWL export**

1. Implement `validateHierarchyAcyclicity` and `computeInheritedAttributesAndRelations` in `hierarchy-validation.ts`.
2. Update `ClassDetail`, `AttributeTable`, and `ClassDetailRelations` to render inherited properties with an `Inherited from <Class>` badge.
3. Update `owl-builder/classes.ts` to export `<owl:disjointWith>` and cardinality `<owl:Restriction>` blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/hierarchy-validation.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/utils/hierarchy-validation.ts src/features/ontology/components/class-detail/ src/features/ontology/server/owl-export/ tests/hierarchy-validation.test.ts
git commit -m "feat(ontology): add hierarchy cycle validation, visual inheritance in detail views, and OWL axiom export"
```

---

### Task 4: Proactive Ambient Typing Assist & Contextual Property Matching

**Files:**

- Create: `src/features/ontology/hooks/use-ontology-assist.ts`
- Create: `src/features/ontology/components/shared/smart-assist-chip.tsx`
- Modify: `src/features/ontology/components/dialogs/create-class-dialog.tsx`
- Modify: `src/features/ontology/components/dialogs/create-relation-dialog/create-relation-dialog.tsx`
- Modify: `src/features/ontology/components/class-detail/class-detail-header.tsx`
- Test: `tests/ontology-assist.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface OntologyAssistResult {
    hasCollision: boolean
    collisionMessage?: string
    standardSuggestion?: {
      curie: string
      label: string
      type: "class" | "property"
      similarity: number
      description?: string
    }
    isCycle?: boolean
    cycleMessage?: string
  }

  export function useOntologyAssist(params: {
    query: string
    entityType: "class" | "attribute" | "relation"
    targetClassId?: string
    allClasses: Array<{ id: string; name: string; module_id?: string | null }>
    parentClassId?: string | null
    referenceTerms?: Array<{
      curie: string
      label: string
      type: string
      domainIris?: string[]
    }>
  }): OntologyAssistResult
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ontology-assist.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateOntologyAssistance } from "../src/features/ontology/hooks/use-ontology-assist"

test("evaluateOntologyAssistance detects exact internal name collision", () => {
  const result = evaluateOntologyAssistance({
    query: "Sensor",
    entityType: "class",
    allClasses: [{ id: "1", name: "Sensor", module_id: "m1" }],
  })
  assert.equal(result.hasCollision, true)
  assert.ok(result.collisionMessage?.includes("already exists"))
})

test("evaluateOntologyAssistance suggests standard vocabulary term", () => {
  const result = evaluateOntologyAssistance({
    query: "Observes",
    entityType: "relation",
    allClasses: [],
    referenceTerms: [
      { curie: "sosa:observes", label: "observes", type: "property" },
    ],
  })
  assert.ok(result.standardSuggestion)
  assert.equal(result.standardSuggestion.curie, "sosa:observes")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/ontology-assist.test.ts`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement hook, `SmartAssistChip`, and wire into creation dialogs**

Implement `useOntologyAssist` and `SmartAssistChip`. Wire them into `CreateClassDialog`, `CreateRelationDialog`, and `ClassDetailHeader` to display ambient suggestions beneath name and parent inputs.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/ontology-assist.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/hooks/use-ontology-assist.ts src/features/ontology/components/shared/smart-assist-chip.tsx src/features/ontology/components/dialogs/ tests/ontology-assist.test.ts
git commit -m "feat(ontology): implement proactive ambient typing assist and collision warnings"
```

---

### Task 5: Deep Full-Ontology Analysis Engine & Alignment Report

**Files:**

- Create: `src/features/ontology/server/services/ontology-analysis/analyze-ontology.ts`
- Create: `src/features/ontology/server/actions/ontology-analysis.ts`
- Create: `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/ontology-analysis-report-dialog.tsx`
- Create: `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/recommended-vocabularies-tab.tsx`
- Create: `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/class-alignment-matrix-tab.tsx`
- Create: `src/features/ontology/components/dialogs/ontology-analysis-report-dialog/redundancy-clusters-tab.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Test: `tests/ontology-analysis.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface OntologyAnalysisResult {
    healthScore: number
    unalignedClassCount: number
    totalClasses: number
    redundancyClusters: Array<{
      clusterName: string
      classIds: string[]
      classNames: string[]
      similarityScore: number
    }>
    recommendedVocabularies: Array<{
      prefix: string
      name: string
      coveredClassCount: number
      coveredClassNames: string[]
      suggestedSource: "ols" | "lov"
    }>
    classAlignments: Array<{
      classId: string
      className: string
      candidateCurie: string
      candidateLabel: string
      similarity: number
    }>
  }
  export async function runFullOntologyAnalysis(
    ontologyId: string
  ): Promise<OntologyAnalysisResult>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ontology-analysis.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { calculateOntologyAnalysis } from "../src/features/ontology/server/services/ontology-analysis/analyze-ontology"

test("calculateOntologyAnalysis clusters redundant classes and scores alignment", async () => {
  const classes = [
    { id: "1", name: "TemperatureMeasurement", description: "Measures temp" },
    { id: "2", name: "TempMeasurement", description: "Records temperature" },
    { id: "3", name: "Platform", description: "Vessel or buoy" },
  ]
  const installedTerms = [
    {
      curie: "sosa:Platform",
      label: "Platform",
      type: "class",
      description: "An entity hosting sensors",
    },
  ]

  const report = await calculateOntologyAnalysis({ classes, installedTerms })
  assert.ok(report.healthScore >= 0 && report.healthScore <= 100)
  assert.ok(report.redundancyClusters.length >= 1)
  assert.ok(
    report.classAlignments.some((a) => a.candidateCurie === "sosa:Platform")
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/ontology-analysis.test.ts`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement analysis engine and interactive report modal**

Implement `analyze-ontology.ts` using local vector embeddings and token similarity. Implement `runFullOntologyAnalysis` server action. Build the 4-tab `OntologyAnalysisReportDialog` and add an **"Analyze Ontology"** health button in `ontology-header.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/ontology-analysis.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/ontology-analysis/ src/features/ontology/server/actions/ontology-analysis.ts src/features/ontology/components/dialogs/ontology-analysis-report-dialog/ src/features/ontology/components/ontology-header/ tests/ontology-analysis.test.ts
git commit -m "feat(ontology): implement deep full-ontology analysis engine and interactive alignment report"
```

---

### Task 6: Impact-Aware Refactor Class Studio & Visual Graph Diff Preview

**Files:**

- Create: `src/features/ontology/server/actions/class-refactoring.ts`
- Create: `src/features/ontology/components/dialogs/refactor-class-dialog/refactor-class-dialog.tsx`
- Create: `src/features/ontology/components/dialogs/refactor-class-dialog/reparent-mode-panel.tsx`
- Create: `src/features/ontology/components/dialogs/refactor-class-dialog/merge-mode-panel.tsx`
- Create: `src/features/ontology/components/dialogs/refactor-class-dialog/neighborhood-graph-diff.tsx`
- Modify: `src/features/ontology/components/class-detail/class-detail-header.tsx`
- Test: `tests/class-refactoring.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface ReparentClassInput {
    ontologyId: string
    classId: string
    targetParentClassId: string | null
    dropAttributeIds?: string[]
  }

  export interface MergeClassesInput {
    ontologyId: string
    sourceClassId: string
    targetClassId: string
    retainedAttributeIds?: string[]
  }

  export async function refactorClassHierarchy(
    input: ReparentClassInput
  ): Promise<{ classId: string }>
  export async function mergeClasses(
    input: MergeClassesInput
  ): Promise<{
    targetClassId: string
    migratedRelations: number
    migratedFacts: number
  }>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/class-refactoring.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ReparentClassInputSchema,
  MergeClassesInputSchema,
} from "../src/features/ontology/server/actions/class-refactoring"

test("ReparentClassInputSchema and MergeClassesInputSchema validate correctly", () => {
  const reparent = ReparentClassInputSchema.parse({
    ontologyId: "11111111-1111-4111-8111-111111111111",
    classId: "22222222-2222-4222-8222-222222222222",
    targetParentClassId: "33333333-3333-4333-8333-333333333333",
  })
  assert.equal(reparent.classId, "22222222-2222-4222-8222-222222222222")

  const merge = MergeClassesInputSchema.parse({
    ontologyId: "11111111-1111-4111-8111-111111111111",
    sourceClassId: "22222222-2222-4222-8222-222222222222",
    targetClassId: "44444444-4444-4444-8444-444444444444",
  })
  assert.equal(merge.targetClassId, "44444444-4444-4444-8444-444444444444")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/class-refactoring.test.ts`  
Expected: FAIL with module not found

- [ ] **Step 3: Implement atomic refactoring server actions and the Refactor Class Studio modal with React Flow visual diff**

1. Implement `class-refactoring.ts` server actions running inside `db.transaction`.
2. Build `neighborhood-graph-diff.tsx` using `@xyflow/react` nodes and edges (green solid additions, red dashed removals, blue/amber modifications).
3. Build `RefactorClassDialog` housing Reparent, Adopt Standard Term, and Merge panels.
4. Add a **"Refactor..."** trigger button in `ClassDetailHeader` beside parent selector.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/class-refactoring.test.ts`  
Expected: PASS

- [ ] **Step 5: Run full project verification suite**

Run: `pnpm check` (lint, typecheck, tests, build)  
Expected: All checks PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/server/actions/class-refactoring.ts src/features/ontology/components/dialogs/refactor-class-dialog/ src/features/ontology/components/class-detail/class-detail-header.tsx tests/class-refactoring.test.ts
git commit -m "feat(ontology): implement impact-aware Refactor Class Studio with visual graph diff preview"
```
