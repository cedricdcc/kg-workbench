# Turtle (.ttl) Ontology Ingestion & Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build end-to-end Turtle (.ttl / RDF / OWL) ontology ingestion converting external RDF ontologies into editable KG Workbench documents with auto-computed Dagre canvas layout, integrated into header actions and the "New Ontology" creation dialog.

**Architecture:** Pure TypeScript parsing via `n3` extracts `owl:Ontology` metadata, classes, datatype/object properties, blank-node `owl:Restriction` axioms, and `owl:NamedIndividual` instances into a validated `ImportOntology` schema payload. A Dagre layout engine calculates non-overlapping hierarchical coordinates for the canvas. The payload is atomically committed to PostgreSQL via the existing `persistOntologyStructure` pipeline and wired to the UI in `ontology-actions-menu` and `create-ontology-dialog`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `n3`, `dagre`, PostgreSQL / Drizzle ORM, TanStack Query, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-10-16-turtle-ontology-import-design.md`](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-16-turtle-ontology-import-design.md)

## Global Constraints

- Run all Turtle parsing and extraction in pure TypeScript without invoking external Python or container services.
- Never write ad-hoc database mutation logic for Turtle import; convert to the validated `ImportOntology` payload and reuse `persistOntologyStructure`, `persistImportMetadata`, `persistImportExamples`, and `appendVisualInserts`.
- Organize all classes and relations from the file into a single default module named after the ontology.
- Format primary namespace entities with clean local names (e.g. `Observatory`) and external entities with CURIEs (e.g. `schema:Thing`, `sf:Point`, `obo:ENVO_00000428`).
- Map named individuals (`owl:NamedIndividual`) and `owl:oneOf` enumeration members to `ontology_examples` as candidate instances with `is_instance_candidate = true` and `instance_policy = "fixed"`.
- Always compute Dagre visual coordinates for imported classes so they render immediately without overlapping.
- Run tests using `pnpm test` (or `npm exec pnpm -- test`).

## Review Focus

1. **EMO-BON Real-World Compatibility**: The exact Core EMO-BON Turtle fixture must extract all classes, `schema:Thing` inheritance, `marineRegion` attribute (`xsd:anyURI`), `hasBiome` relation, restrictions, and `SampleType` individuals without dropping axioms.
2. **Union Domain Handling**: Properties with `owl:unionOf` domains (e.g. `core:waterColumnDepth` on `sosa:Sampling` and `core:Observatory`) must attach cleanly to all participating classes.
3. **Blank Node & Cycle Guard**: Cyclic blank-node subclass references or anonymous restriction nodes must not create infinite loops or orphaned classes.
4. **Custom Datatype Fallback**: Datatypes outside standard XSD (e.g. `geo:wktLiteral`, `shacl:IRI`, `qudt:QuantityValue`) must safely map to `xsd:string` while preserving original datatype IRIs in comments.
5. **Atomic Transaction Rollback**: If a database write fails midway, the entire import must roll back cleanly leaving zero orphaned rows in `ontology_documents` or child tables.

---

### Task 1: Core Turtle RDF Parser & Semantic Extractor

**Files:**

- Create: `src/features/ontology/server/services/turtle-importer/types.ts`
- Create: `src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology.ts`
- Test: `tests/turtle-ontology-parser.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface ParseTurtleOptions {
    fileName?: string
    defaultLanguage?: string
  }

  export function parseTurtleToImportOntology(
    content: string,
    options?: ParseTurtleOptions
  ): ImportOntology
  ```

- [ ] **Step 1: Write the failing test with the EMO-BON Turtle fixture**

```typescript
// tests/turtle-ontology-parser.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseTurtleToImportOntology } from "../src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology"

const EMOBON_TTL = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dc: <http://purl.org/dc/elements/1.1/> . 
@prefix dct: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix vann: <http://purl.org/vocab/vann/> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix core: <https://data.emobon.embrc.eu/ns/core#> .

<https://data.emobon.embrc.eu/ns/core>
  a owl:Ontology ;
  owl:versionIRI <https://data.emobon.embrc.eu/ns/core.ttl> ;
  rdfs:label "The Core EMO-BON Ontology"@en ;
  rdfs:comment "The Core EMO-BON ontology provides definitions for the core classes and properties."@en ;
  vann:preferredNamespacePrefix "core" ;
  vann:preferredNamespaceUri "https://data.emobon.embrc.eu/ns/core#" .

schema:Thing a owl:Class .

<https://data.emobon.embrc.eu/ns/core#Observatory>
  a owl:Class ;
  rdfs:subClassOf schema:Thing, [
    a owl:Restriction ;
    owl:onProperty <https://data.emobon.embrc.eu/ns/core#broadBiome> ;
    owl:someValuesFrom <http://purl.obolibrary.org/obo/ENVO_00000428> ;
  ], [
    a owl:Restriction ;
    owl:onProperty <https://data.emobon.embrc.eu/ns/core#marineRegion> ;
    owl:qualifiedCardinality "1"^^xsd:nonNegativeInteger ;
    owl:onDataRange xsd:anyURI ;
  ] .

<http://purl.obolibrary.org/obo/ENVO_00000428> a owl:Class .

<https://data.emobon.embrc.eu/ns/core#SampleType>
  a owl:Class ;
  owl:equivalentClass [
    a owl:Class ;
    rdfs:subClassOf skos:Concept ;
    owl:oneOf (
      <https://data.emobon.embrc.eu/ns/core#Hard>
      <https://data.emobon.embrc.eu/ns/core#Soil>
      <https://data.emobon.embrc.eu/ns/core#Water>
    )
  ] .

<https://data.emobon.embrc.eu/ns/core#Hard> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .
<https://data.emobon.embrc.eu/ns/core#Soil> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .
<https://data.emobon.embrc.eu/ns/core#Water> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .

<https://data.emobon.embrc.eu/ns/core#hasBiome>
  a owl:ObjectProperty ;
  rdfs:domain <https://data.emobon.embrc.eu/ns/core#Observatory> ;
  rdfs:range <http://purl.obolibrary.org/obo/ENVO_00000428> .

<https://data.emobon.embrc.eu/ns/core#broadBiome>
  a owl:ObjectProperty ;
  rdfs:subPropertyOf <https://data.emobon.embrc.eu/ns/core#hasBiome> .

<https://data.emobon.embrc.eu/ns/core#marineRegion>
  a owl:DatatypeProperty ;
  rdfs:domain <https://data.emobon.embrc.eu/ns/core#Observatory> ;
  rdfs:range xsd:anyURI .
`

test("parseTurtleToImportOntology extracts metadata, classes, properties, restrictions, and individuals", () => {
  const result = parseTurtleToImportOntology(EMOBON_TTL)

  assert.equal(result.name, "The Core EMO-BON Ontology")
  assert.equal(result.version, "https://data.emobon.embrc.eu/ns/core.ttl")
  assert.ok(result.usecase.includes("core classes and properties"))

  // Classes
  const classNames = result.classes.map((c) => c.name)
  assert.ok(classNames.includes("Observatory"))
  assert.ok(classNames.includes("SampleType"))
  assert.ok(classNames.includes("schema:Thing"))
  assert.ok(classNames.includes("obo:ENVO_00000428"))

  // Subclass
  const obsClass = result.classes.find((c) => c.name === "Observatory")!
  const thingClass = result.classes.find((c) => c.name === "schema:Thing")!
  assert.equal(obsClass.parentClassId, thingClass.id)

  // Attributes on Observatory
  const marineRegionAttr = obsClass.attributes.find(
    (a) => a.name === "marineRegion"
  )
  assert.ok(marineRegionAttr)
  assert.equal(marineRegionAttr?.dataType, "xsd:anyURI")
  assert.equal(marineRegionAttr?.required, true)

  // Relations
  const hasBiomeRel = result.relations.find((r) => r.name === "hasBiome")
  assert.ok(hasBiomeRel)
  assert.equal(hasBiomeRel?.domainClassId, obsClass.id)

  // Individuals on SampleType
  const sampleTypeClass = result.classes.find((c) => c.name === "SampleType")!
  const candidateExamples = result.examples.filter(
    (e) => e.targetId === sampleTypeClass.id && e.isInstanceCandidate
  )
  assert.equal(candidateExamples.length, 3)
  const exampleValues = candidateExamples.map((e) => e.value)
  assert.ok(exampleValues.includes("Hard"))
  assert.ok(exampleValues.includes("Soil"))
  assert.ok(exampleValues.includes("Water"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/turtle-ontology-parser.test.ts`  
Expected: FAIL with missing module/function.

- [ ] **Step 3: Implement `parseTurtleToImportOntology`**

Implement `src/features/ontology/server/services/turtle-importer/types.ts` and `src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology.ts`:

- Use `new n3.Parser()` to obtain quads and prefixes.
- Extract `owl:Ontology` metadata and primary namespace URI.
- Index and map classes, relations, datatype attributes, blank-node restrictions, and individuals.
- Normalize datatypes to `OntologyDataTypeId` with fallback to `xsd:string`.
- Return a validated `ImportOntology` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/turtle-ontology-parser.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/turtle-importer/ tests/turtle-ontology-parser.test.ts
git commit -m "feat(ontology): implement pure TypeScript Turtle parser and semantic extractor"
```

---

### Task 2: Canvas Auto-Layout Engine with Dagre

**Files:**

- Create: `src/features/ontology/server/services/turtle-importer/layout.ts`
- Modify: `src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology.ts`
- Test: `tests/turtle-ontology-layout.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export function computeOntologyDagreLayout(
    classes: ImportClass[],
    relations: ImportRelation[],
    moduleName: string
  ): ImportOntologyVisual
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/turtle-ontology-layout.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { computeOntologyDagreLayout } from "../src/features/ontology/server/services/turtle-importer/layout"
import type {
  ImportClass,
  ImportRelation,
} from "../src/features/ontology/schemas/import"

test("computeOntologyDagreLayout generates non-overlapping coordinates for classes and bounding module layout", () => {
  const classes: ImportClass[] = [
    { id: "c1", name: "Parent", description: "", attributes: [] },
    {
      id: "c2",
      name: "ChildA",
      parentClassId: "c1",
      description: "",
      attributes: [],
    },
    {
      id: "c3",
      name: "ChildB",
      parentClassId: "c1",
      description: "",
      attributes: [],
    },
  ]
  const relations: ImportRelation[] = [
    {
      id: "r1",
      name: "connectsTo",
      domainClassId: "c2",
      rangeClassId: "c3",
      description: "",
    },
  ]

  const visual = computeOntologyDagreLayout(classes, relations, "Core Module")

  assert.equal(visual.classPositions.length, 3)
  assert.equal(visual.moduleLayouts.length, 1)

  const pos1 = visual.classPositions.find((p) => p.classId === "c1")!
  const pos2 = visual.classPositions.find((p) => p.classId === "c2")!
  const pos3 = visual.classPositions.find((p) => p.classId === "c3")!

  assert.ok(typeof pos1.x === "number" && typeof pos1.y === "number")
  // Parent should be placed above children (rankdir TB)
  assert.ok(pos1.y < pos2.y)
  assert.ok(pos1.y < pos3.y)

  // Module bounds contain all class coordinates
  const moduleLayout = visual.moduleLayouts[0]
  assert.ok(moduleLayout.width > 200)
  assert.ok(moduleLayout.height > 100)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/turtle-ontology-layout.test.ts`  
Expected: FAIL with missing module/function.

- [ ] **Step 3: Implement `computeOntologyDagreLayout` and integrate into `parseTurtleToImportOntology`**

In `src/features/ontology/server/services/turtle-importer/layout.ts`:

- Instantiate `new dagre.graphlib.Graph()`.
- Set graph options `rankdir: "TB"`, `nodesep: 60`, `ranksep: 80`.
- Add class nodes with `{ width: 220, height: 100 }`.
- Add directed edges for `parentClassId` hierarchy and `relations`.
- Execute `dagre.layout(g)` and extract coordinates.
- Calculate outer bounding box for `moduleLayouts`.
- In `parseTurtleToImportOntology.ts`, call `computeOntologyDagreLayout` and attach to `parsed.visual`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/turtle-ontology-layout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/turtle-importer/ tests/turtle-ontology-layout.test.ts
git commit -m "feat(ontology): implement Dagre auto-layout for imported Turtle ontologies"
```

---

### Task 3: Server Action for Turtle Ingestion & Persistence

**Files:**

- Create: `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts`
- Modify: `src/features/ontology/server/actions/ontology-transfer/index.ts`
- Test: `tests/turtle-ontology-import-action.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export interface ImportOntologyFromTurtleInput {
    content: string
    fileName?: string
  }

  export interface ImportOntologyFromTurtleResult {
    ontologyId: string
    warnings: string[]
  }

  export async function importOntologyFromTurtle(
    input: File | ImportOntologyFromTurtleInput
  ): Promise<ImportOntologyFromTurtleResult>
  ```

- [ ] **Step 1: Write the failing action test**

```typescript
// tests/turtle-ontology-import-action.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { importOntologyFromTurtleInternal } from "../src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle"

test("importOntologyFromTurtleInternal parses Turtle and persists ontology transactionally", async () => {
  const minimalTtl = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <https://example.org/ns#> .

    <https://example.org/ns>
      a owl:Ontology ;
      rdfs:label "Minimal Example"@en .

    ex:Sensor a owl:Class .
  `

  const result = await importOntologyFromTurtleInternal({
    content: minimalTtl,
    fileName: "minimal.ttl",
  })

  assert.ok(result.ontologyId)
  assert.ok(Array.isArray(result.warnings))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- test tests/turtle-ontology-import-action.test.ts`  
Expected: FAIL with missing module.

- [ ] **Step 3: Implement `importOntologyFromTurtle` action**

In `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts`:

- Handle both `File` (extracting text via `await file.text()`) and `{ content, fileName }` input.
- Parse content with `parseTurtleToImportOntology`.
- Validate with `ImportOntologySchema.parse(parsed)`.
- Connect to database via `getDb()` and execute:
  1. `persistOntologyStructure({ db, parsed, fileName, warnings })`
  2. `persistCompetencyQuestions({ db, ontologyId, parsed, idMaps, warnings })`
  3. `persistImportMetadata({ db, ontologyId, parsed, idMaps, warnings })`
  4. `persistImportExamples({ db, ontologyId, parsed, idMaps, warnings })`
  5. `appendVisualInserts({ db, ontologyId, parsed, warnings, idMaps })`
- Call `revalidatePath(routes.ontology.root)`.
- Re-export `importOntologyFromTurtle` from `src/features/ontology/server/actions/ontology-transfer/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- test tests/turtle-ontology-import-action.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/actions/ontology-transfer/ tests/turtle-ontology-import-action.test.ts
git commit -m "feat(ontology): implement importOntologyFromTurtle server action with atomic persistence"
```

---

### Task 4: UI Integration in Header Menu & "New Ontology" Dialog

**Files:**

- Modify: `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/dialogs/create-ontology-dialog.tsx`

**Interfaces:**

- Extends `OntologyActionsMenuProps`:
  ```typescript
  turtleFileInputRef: RefObject<HTMLInputElement | null>
  onImportTurtle: () => void
  onTurtleFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  ```
- Extends `CreateOntologyDialog`:
  - Renders tabbed interface with "Blank Ontology" and "Import from Turtle" options.

- [ ] **Step 1: Update `ontology-actions-menu.tsx` and `ontology-header.tsx`**

- In `ontology-actions-menu.tsx`:
  - Add hidden file input with `ref={turtleFileInputRef}`, `accept=".ttl,.n3,.owl"`, and `onChange={onTurtleFileChange}`.
  - Add dropdown menu item:
    ```tsx
    <DropdownMenuItem onClick={onImportTurtle}>
      <FileCode className="mr-2 h-4 w-4" />
      Import from Turtle (.ttl)...
    </DropdownMenuItem>
    ```
- In `ontology-header.tsx`:
  - Add `turtleFileInputRef`.
  - Wire `handleTurtleFileChange` to call `importOntologyFromTurtle(file)` with loading spinner and Sonner toasts.
  - Redirect to `${routes.ontology.root}?doc=${ontologyId}` upon successful import.

- [ ] **Step 2: Update `create-ontology-dialog.tsx` with Turtle Import tab**

In `src/features/ontology/components/dialogs/create-ontology-dialog.tsx`:

- Add `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent`.
- Tab 1 ("Blank Ontology"): Keep existing form (name, language, usecase).
- Tab 2 ("Import from Turtle"):
  - Add drag-and-drop / file selector for `.ttl` files.
  - Add collapsible textarea for pasting Turtle content directly.
  - Perform live lightweight client-side header detection (showing detected title and comment).
  - Submit button triggers `importOntologyFromTurtle`, invokes `onSuccess(ontologyId)`, and closes dialog.

- [ ] **Step 3: Verify the UI build and lint**

Run: `npm exec pnpm -- check`  
Expected: All lints, typechecks, and tests PASS without errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/ontology/components/
git commit -m "feat(ontology): integrate Turtle import into header actions and create ontology dialog"
```
