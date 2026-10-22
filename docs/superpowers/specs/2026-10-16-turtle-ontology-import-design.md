# Turtle (.ttl) Ontology Ingestion & Creation Design Spec

**Date:** 2026-10-16  
**Status:** In Review  
**Topic:** End-to-end architecture for importing real-world Turtle (.ttl / RDF / OWL) ontologies into KG Workbench as editable ontology documents, integrated into header actions and the "New Ontology" creation dialog.

---

## 1. Problem Statement & Motivation

Currently, KG Workbench allows users to create empty ontologies and export them to JSON or OWL RDF/XML. However, importing external ontologies into the workbench is restricted to a custom JSON structure (`importOntologyFromJson`).

Real-world ontologies—such as EMO-BON (EMBRC/VLIZ), W3C SOSA/SSN, ENVO, and Schema.org—are authored and published in RDF Turtle (`.ttl`) format. They contain:

- Complex subclass hierarchies (`rdfs:subClassOf`)
- Blank-node restrictions (`owl:Restriction` with qualified cardinalities, `owl:someValuesFrom`, `owl:allValuesFrom`)
- Object properties (`owl:ObjectProperty`) connecting classes
- Datatype properties (`owl:DatatypeProperty`) with single or union domains (`owl:unionOf`)
- Controlled enumerations and named individuals (`owl:NamedIndividual`, `owl:oneOf`, `skos:Concept`)

Knowledge engineers cannot currently load these existing files into KG Workbench as editable workspace documents. Importing `.ttl` files directly—both as a standalone import and as an initialization option when creating a new ontology—enables instant visualization on the React Flow canvas, class/relation inspection, linter auditing, and downstream document fact extraction.

---

## 2. Goals & Non-Goals

### Goals

- **Turtle Ingestion to Editable Ontology Document**: Provide pure TypeScript ingestion (`n3`) converting `.ttl` files into the workbench's `ImportOntology` schema and persisting them atomically in PostgreSQL.
- **Support Real-World OWL Axioms**:
  - `owl:Ontology` metadata (`rdfs:label`, `rdfs:comment`, `owl:versionIRI`, namespace annotations).
  - Classes (`owl:Class`, `rdfs:Class`) and hierarchies (`rdfs:subClassOf`).
  - Datatype properties (`owl:DatatypeProperty`) mapped to class attributes with normalized XSD datatypes.
  - Object properties (`owl:ObjectProperty`) mapped to relations between domain and range classes.
  - Cardinality & existential restrictions (`owl:Restriction`) mapped to `ontology_class_restrictions` and attribute required flags.
  - Controlled enumerations (`owl:oneOf`) and named individuals (`owl:NamedIndividual`) mapped to `ontology_examples` as candidate instances with `instance_policy = "fixed"`.
- **Intelligent Entity Naming**:
  - Entities belonging to the ontology's primary namespace are formatted as clean local names (e.g. `Observatory`, `SampleType`).
  - Entities from external namespaces are formatted as standard CURIEs (e.g. `schema:Thing`, `sf:Point`, `obo:ENVO_00000428`).
- **Unified Single-Module Scoping**: All classes and relations in the file are organized into a single default module named after the ontology.
- **Canvas Auto-Layout**: Automatically compute non-overlapping hierarchical $(x, y)$ positions using Dagre so the React Flow canvas is immediately readable upon import.
- **UI Integrations**:
  - Add **"Import from Turtle (.ttl)..."** to `ontology-actions-menu.tsx`.
  - Add an **"Import from Turtle (.ttl)"** tab to `create-ontology-dialog.tsx` (supporting file upload and text paste).

### Non-Goals

- Full First-Order Logic or description logic classification reasoning (e.g. Pellet/HermiT).
- In-place multi-file diff/merge into existing populated ontologies (this spec focuses on importing into a new ontology document).

---

## 3. High-Level Architecture & Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          1. INPUT & PARSING (n3)                                │
│  - Accepts .ttl file or pasted Turtle text                                       │
│  - n3.Parser parses RDF quads and extracts prefix mappings                      │
│  - Detects owl:Ontology subject, title, comment, version, primary prefix/URI    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    2. SEMANTIC EXTRACTION & NORMALIZATION                       │
│  - Classes: owl:Class / rdfs:Class -> ImportClass (clean names vs CURIEs)      │
│  - Subclasses: rdfs:subClassOf named targets -> parentClassId                   │
│  - Attributes: owl:DatatypeProperty & restrictions -> ImportAttribute          │
│  - Relations: owl:ObjectProperty & restrictions -> ImportRelation               │
│  - Axioms: owl:Restriction -> ImportRestriction (exact, min, max, some, all)    │
│  - Instances: owl:NamedIndividual & owl:oneOf -> ImportExample (candidates)     │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        3. DAGRE CANVAS AUTO-LAYOUT                              │
│  - Constructs dagre.graphlib.Graph with class nodes and hierarchy/relation edges│
│  - Computes non-overlapping (x, y) coordinates for all classes                  │
│  - Populates ImportOntologyVisualSchema (classPositions, moduleLayouts)         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   4. ATOMIC DATABASE PERSISTENCE                                │
│  - Runs inside single PostgreSQL transaction:                                   │
│    * persistOntologyStructure (document, module, classes, attributes, relations)│
│    * persistImportMetadata (notes, descriptions, localizedTexts)                │
│    * persistImportExamples (candidate instances & named individuals)            │
│    * appendVisualInserts (class positions & module bounds)                      │
│  - Revalidates Next.js cache and redirects to ?doc=${ontologyId}                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 Parser & Semantic Extractor (`parseTurtleToImportOntology`)

Located at: `src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology.ts`

#### 1. Header Resolution

- Traverses quads for `?s a owl:Ontology`.
- Resolves:
  - `name`: `rdfs:label` ?? URI fragment ?? "Imported Ontology".
  - `usecase`: `rdfs:comment` ?? `dc:description` ?? `dct:description` ?? "".
  - `version`: `owl:versionIRI` ?? `owl:versionInfo` ?? null.
  - `primaryNamespaceUri`: `vann:preferredNamespaceUri` ?? subject IRI.
  - `primaryPrefix`: `vann:preferredNamespacePrefix` ?? detected prefix ?? "core".

#### 2. Class Resolution & Naming

- Identifies subjects with `rdf:type owl:Class` or `rdf:type rdfs:Class`.
- Blank nodes are filtered out from standalone classes (treated as restriction expressions).
- **Naming Rule**:
  - If subject IRI starts with `primaryNamespaceUri`: strip URI to get the local name (e.g. `Observatory`, `SampleType`).
  - Otherwise: match against prefixes (or known prefixes like `schema`, `sf`, `geo`, `skos`, `obo`) to format as CURIE (e.g. `schema:Thing`, `sf:Point`, `obo:ENVO_00000428`).
- **Hierarchy (`rdfs:subClassOf`)**:
  - If object is an IRI: sets `parentClassId` (resolving to target class ID).
  - If multiple named superclasses exist: sets the first as `parentClassId` and records additional superclasses in notes.

#### 3. Properties & Restrictions Mapping

- **Datatype Properties**:
  - Filter `rdf:type owl:DatatypeProperty`.
  - For each `rdfs:domain`:
    - If domain is an IRI: attaches an `ImportAttribute` to that class.
    - If domain is `owl:unionOf ( ... )`: attaches an `ImportAttribute` to all constituent classes.
  - `rdfs:range` is normalized via `normalizeOntologyDataType` (e.g. `xsd:string`, `xsd:positiveInteger`, `xsd:anyURI`). Custom datatypes (e.g. `geo:wktLiteral`, `shacl:IRI`, `qudt:QuantityValue`) map to `xsd:string` with the original datatype IRI preserved in description.
- **Object Properties**:
  - Filter `rdf:type owl:ObjectProperty`.
  - For each `rdfs:domain` and `rdfs:range`: creates an `ImportRelation` between domain and range class.
- **Class Restrictions (`owl:Restriction`)**:
  - Evaluates blank nodes linked via `rdfs:subClassOf`:
    - `owl:onProperty`: property IRI.
    - Qualified cardinalities: `owl:qualifiedCardinality` (exact), `owl:minQualifiedCardinality` (min), `owl:maxQualifiedCardinality` (max).
    - Ranges: `owl:onDataRange` (for attributes) or `owl:onClass`, `owl:someValuesFrom`, `owl:allValuesFrom` (for relations).
    - If `owl:onDataRange` is present or property is a datatype: registers/updates the attribute on the class with `required: true` (if cardinality $\ge 1$).
    - If `owl:onClass` or existential range is present: connects relation between domain class and target class.
    - Stores the structured restriction in `class.restrictions`.

#### 4. Named Individuals & Controlled Enumerations

- Identifies `?ind a owl:NamedIndividual` and `?ind a <ClassIRI>`.
- Identifies `owl:equivalentClass [ a owl:Class ; rdfs:subClassOf skos:Concept ; owl:oneOf ( ... ) ]`.
- Maps each individual to an `ImportExample`:
  - `targetType: "class"`
  - `targetId: classId`
  - `value`: Individual local name or `skos:prefLabel`
  - `isInstanceCandidate: true`
- If a class defines an `owl:oneOf` enumeration, sets `instancePolicy: "fixed"`.

---

### 4.2 Auto-Layout Engine (Dagre)

Located at: `src/features/ontology/server/services/turtle-importer/layout.ts`

- Initializes `new dagre.graphlib.Graph()`.
- Sets graph options: `rankdir: "TB"`, `nodesep: 60`, `ranksep: 80`.
- Adds every class node with dimensions `{ width: 220, height: 100 }`.
- Adds directed edges for:
  - `rdfs:subClassOf` (parent $\to$ child)
  - Relations (domain $\to$ range)
- Runs `dagre.layout(g)`.
- Populates `ImportOntology["visual"]`:
  - `classPositions`: array of `{ classId, module, x, y }`.
  - `moduleLayouts`: bounding box containing all class positions with 40px padding.

---

### 4.3 Server Actions & Atomic Persistence

Located at: `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts`

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
  fileOrInput: File | ImportOntologyFromTurtleInput
): Promise<ImportOntologyFromTurtleResult>
```

**Execution Pipeline**:

1. Extracts text content from `File` or string input.
2. Calls `parseTurtleToImportOntology(content, { fileName })`.
3. Validates output with `ImportOntologySchema.parse(parsed)`.
4. Executes atomic database transactions:
   - `persistOntologyStructure({ db, parsed, fileName, warnings })`
   - `persistCompetencyQuestions({ db, ontologyId, parsed, idMaps, warnings })`
   - `persistImportMetadata({ db, ontologyId, parsed, idMaps, warnings })`
   - `persistImportExamples({ db, ontologyId, parsed, idMaps, warnings })`
   - `appendVisualInserts({ db, ontologyId, parsed, warnings, idMaps })`
5. Calls `revalidatePath(routes.ontology.root)`.
6. Returns `{ ontologyId, warnings }`.

---

### 4.4 UI Integration

#### 1. Header Dropdown Menu (`ontology-actions-menu.tsx`)

- Adds menu item:
  ```tsx
  <DropdownMenuItem onClick={onImportTurtle}>
    <FileCode className="mr-2 h-4 w-4" />
    Import from Turtle (.ttl)...
  </DropdownMenuItem>
  ```
- Hidden file input with `accept=".ttl,.n3,.owl"`.
- During upload: triggers `isBusy` spinning state in header, displays Sonner toasts for progress, success, and any non-fatal warnings.

#### 2. "New Ontology" Dialog (`create-ontology-dialog.tsx`)

- Adds tabbed interface using shadcn `Tabs`:
  - Tab 1: **"Blank Ontology"** (existing creation inputs: Name, Default Language, Usecase).
  - Tab 2: **"Import from Turtle"**:
    - File upload dropzone (`.ttl`, `.n3`, `.owl`).
    - Collapsible text area for pasting Turtle directly.
    - Live client-side header preview showing extracted ontology name, comment, and class count before submission.
    - Submit button: **"Create from Turtle"**.

---

## 5. Error Handling & Edge Cases

| Scenario                             | Behavior                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Syntax Error in Turtle**           | Caught from `n3.Parser` and returned as a clear, user-facing error message including line and token details.                                                        |
| **Missing `owl:Ontology` Triple**    | Defaults ontology name to the uploaded filename, uses prefix or fragment as base namespace, and sets language to `"en"`.                                            |
| **Properties without Domain**        | Properties without explicit `rdfs:domain` that appear in class restrictions are scoped to that class. Unreferenced domain-less properties are recorded as warnings. |
| **Multi-Domain Properties & Unions** | Properties with `owl:unionOf` domains are attached as attributes/relations to every participating class.                                                            |
| **Custom / Unknown Datatypes**       | Safely mapped to `xsd:string` fallback with original datatype IRI retained in description.                                                                          |
| **Circular Subclasses**              | Cycle broken at second occurrence with a warning to avoid infinite loops; surfaced in defect linter.                                                                |

---

## 6. Testing Strategy

### 6.1 Unit Tests (`tests/turtle-ontology-parser.test.ts`)

- **EMO-BON Real-World Fixture Test**:
  - Feeds the complete Core EMO-BON Turtle snippet provided by the user.
  - Asserts `name === "The Core EMO-BON Ontology"`.
  - Asserts classes: `Observatory`, `SampleType`, `schema:Thing`, `schema:PostalAddress`, `sf:Point`, `sf:Geometry`, `ENVO_00000428`.
  - Asserts inheritance: `Observatory` $\to$ `schema:Thing`, `Point` $\to$ `Geometry`.
  - Asserts attributes: `marineRegion` (`xsd:anyURI`), `observatoryId` (`xsd:string`), `schema:description`, `schema:identifier`.
  - Asserts relations: `hasBiome` (`Observatory` $\to$ `ENVO_00000428`), `geoLocation` (`Observatory` $\to$ `Point`), `sampleType` (`Observatory` $\to$ `SampleType`).
  - Asserts examples: `Hard`, `Soil`, `Water` attached to `SampleType` as instance candidates with `fixed` policy.
  - Asserts Dagre layout generated non-zero $(x, y)$ coordinates for every class.
- **Edge Case Tests**:
  - Malformed syntax error reporting.
  - Missing `owl:Ontology` fallback.
  - Union domains (`core:waterColumnDepth`).

### 6.2 Action Integration Tests (`tests/turtle-ontology-import-action.test.ts`)

- Calls `importOntologyFromTurtle` with fixture.
- Verifies database records created in `ontology_documents`, `ontology_modules`, `ontology_classes`, `ontology_attributes`, `ontology_relations`, `ontology_examples`, and `ontology_class_positions`.
