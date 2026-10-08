# External Ontology Mapping & Local Vector Alignment Design

## 1. Overview & Goals

Currently, the ontology authoring workflows (both manual modeling and AI draft generation from Competency Questions) construct domain statements and classes strictly from scratch. In knowledge engineering and semantic web practice (e.g. W3C, FAIR principles, OBO Foundry), reusing established standard ontologies and vocabularies (e.g. SOSA/SSN for sensor and sampling observations, ENVO for environmental contexts, Darwin Core for biodiversity observations, QUDT for quantities and units, schema.org for general concepts) is essential for interoperability and semantic quality.

This system introduces a **Reference Vocabulary Catalog with Local Zero-Cost Vector Alignment**:
1. **Public Registry Connectors**: Search and fetch standard ontologies on demand from public registries (**EBI OLS4** and **Linked Open Vocabularies / LOV**) with zero API keys required.
2. **Local Workspace Catalog & Refetch**: Maintain an internal workspace state of registered ontologies and indexed terms in PostgreSQL, allowing users to refetch and update vocabularies whenever needed.
3. **Zero-Cost Local In-Process Vector Embeddings**: Embed reference terms using a lightweight, local in-process embedding engine (e.g. ONNX / Transformers.js `all-MiniLM-L6-v2` or local Ollama), completely avoiding consumption of external LLM API credits.
4. **Semantic CQ Alignment & Rationale**: Pre-filter candidate terms via local vector similarity to ground AI ontology generation, producing explicit semantic rationales and confidence scores for CQ answers.
5. **Contextual Graph Expansion (Option B)**: Automatically resolve direct parent hierarchies and associated relational edges when adopting an external term.
6. **Interactive Entity Inspector & Review Modal**: Provide transparent review badges in the generation wizard and interactive "Map / Adopt Standard Term" recommendations directly in the entity detail panel.

---

## 2. Architecture & Data Model

### 2.1 Database Schema (PostgreSQL via Drizzle)

#### Table: `reference_ontologies`
Maintains the metadata of registered external ontologies per workspace.
```typescript
export const referenceOntologies = pgTable("reference_ontologies", {
  id: uuid("id").defaultRandom().primaryKey(),
  prefix: text("prefix").notNull(), // e.g. "sosa", "envo", "qudt"
  name: text("name").notNull(), // e.g. "Sensor, Observation, Sample, and Actuator"
  base_iri: text("base_iri").notNull(), // e.g. "http://www.w3.org/ns/sosa/"
  source_registry: text("source_registry").notNull(), // 'ols' | 'lov' | 'custom'
  source_id: text("source_id").notNull(), // e.g. "sosa" in OLS
  version: text("version").default(""),
  synced_at: timestamp("synced_at", { withTimezone: true, mode: "string" }).defaultNow(),
  group_key: text("group_key").notNull().default("shared"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
})
```

#### Table: `reference_ontology_terms`
Caches indexed classes, properties, and individuals with their signatures and local vector embeddings.
```typescript
export const referenceOntologyTerms = pgTable("reference_ontology_terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference_ontology_id: uuid("reference_ontology_id").notNull().references(() => referenceOntologies.id, { onDelete: "cascade" }),
  curie: text("curie").notNull(), // e.g. "sosa:Observation"
  iri: text("iri").notNull(), // e.g. "http://www.w3.org/ns/sosa/Observation"
  label: text("label").notNull(), // e.g. "Observation"
  type: text("type").notNull(), // 'class' | 'property' | 'individual'
  description: text("description").notNull().default(""),
  synonyms: text("synonyms").array().default(sql`'{}'::text[]`),
  parent_iris: text("parent_iris").array().default(sql`'{}'::text[]`),
  related_property_iris: text("related_property_iris").array().default(sql`'{}'::text[]`),
  embedding: real("embedding").array(), // 384-dimensional float vector
  group_key: text("group_key").notNull().default("shared"),
})
```

---

## 3. Public Registry Connectors & Sync Engine

### 3.1 Registry Clients
Located under `src/features/ontology/server/services/vocabulary-registries/`:
1. **OLS4 Client (`ols4-client.ts`)**:
   - Search: `GET https://www.ebi.ac.uk/ols4/api/search?q={query}&type=ontology`
   - Term Extraction: `GET https://www.ebi.ac.uk/ols4/api/ontologies/{ontologyId}/terms?size=500`
   - Maps OLS terms to canonical CURIE, IRI, label, description, synonyms, and parent relationships (`is_defining_ontology = true`).
2. **LOV Client (`lov-client.ts`)**:
   - Search: `GET https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/search?q={query}`
   - Term Extraction: `GET https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/terms?vocab={prefix}`
   - Normalizes standard RDF/OWL terms, prefixes, and namespaces.

### 3.2 Sync Engine (`sync-reference-ontology.ts`)
- Server action `syncReferenceOntology(referenceOntologyId: string)`:
  1. Validates workspace access via `assertWorkspaceAccess`.
  2. Queries the source registry for updated terms.
  3. Batches term text through the local in-process embedder.
  4. Upserts terms and vector arrays into `reference_ontology_terms`.
  5. Updates `synced_at` timestamp.

---

## 4. Local Zero-Cost Vector Embedding & Similarity Engine

### 4.1 In-Process Embedder (`src/server/embedding/local-embedder.ts`)
- Uses `@xenova/transformers` with `all-MiniLM-L6-v2` (quantized ONNX, ~23MB cached locally in server runtime):
  - **Zero Cost**: 0 LLM API credits, 0 external network requests to Gemini or OpenAI.
  - **Performance**: High throughput (hundreds of embeddings/sec on CPU).
  - **Signature**:
    ```typescript
    export async function getLocalEmbedding(text: string): Promise<number[]>
    export async function getLocalBatchEmbeddings(texts: string[]): Promise<number[][]>
    ```
- **Fallback**: If ONNX initialization fails, seamlessly falls back to local Ollama embedding (`POST http://localhost:11434/api/embeddings`) or token trigram similarity.

### 4.2 Vector Search Service (`src/features/ontology/server/services/vector-similarity.ts`)
- Computes cosine similarity between query vector and active terms in PostgreSQL:
  $$\text{cosineSimilarity}(A, B) = \frac{\sum A_i B_i}{\sqrt{\sum A_i^2} \sqrt{\sum B_i^2}}$$
- Returns top-K candidates:
  ```typescript
  export type VectorMatch = {
    termId: string
    curie: string
    iri: string
    label: string
    type: "class" | "property"
    description: string
    similarity: number // 0.0 to 1.0
    ontologyPrefix: string
    ontologyName: string
  }
  ```

---

## 5. AI CQ Grounding & Contextual Graph Expansion (Option B)

### 5.1 Pre-Filter Pipeline in `generateOntologyDraft`
1. For each CQ in the ontology:
   - Compute local embedding of `cq.question`.
   - Query `findSimilarReferenceTerms(embedding, { topK: 4, minSimilarity: 0.70 })`.
2. Construct augmented prompt in `prompt-builder.ts`:
   - Inject candidate standard terms under `Recommended Standard Vocabularies`.
   - Prompt instructions guide the LLM to map concepts to these standard CURIEs wherever suitable.

### 5.2 Alignment Schema Output
Extend `GeneratedClassSchema` and `GeneratedRelationSchema`:
```typescript
export const EntityAlignmentSchema = z.object({
  mode: z.enum(["reuse", "subClassOf", "equivalentClass"]),
  targetCurie: z.string(),
  targetIri: z.string(),
  similarityScore: z.number().optional(),
  rationale: z.string(), // Human-readable justification of fit for CQ
})
```

### 5.3 Contextual Graph Expansion (Option B)
When a reference term is selected in the draft:
- Query `reference_ontology_terms` for its direct `parent_iris` and `related_property_iris`.
- Generate `suggestedContext` entities in the draft:
  - Parent classes (e.g. `sosa:FeatureOfInterest` for `sosa:Observation`).
  - Related properties (e.g. `sosa:hasFeatureOfInterest`, `sosa:madeBySensor`).
- In the review dialog, these are grouped under an expandable section with checkboxes for selective inclusion.

---

## 6. User Interface & Interactions

### 6.1 Reference Vocabularies Management Dialog
- **Trigger**: New "Vocabularies" button in `OntologyHeader`.
- **Search Tab**:
  - Live search input against OLS4 and LOV APIs.
  - Results card displaying title, prefix, description, source badge (`[OLS4]`, `[LOV]`), and "Add to Workspace" button.
- **Library Tab**:
  - Lists all active reference ontologies in the current workspace.
  - Displays term count, prefix, and last sync timestamp.
  - "Sync / Refetch" button and "Remove" button.

### 6.2 Staged Review Dialog Enhancements (`AiGenerateReviewStep`)
- Classes and relations with standard alignments display a styled badge: e.g. `[sosa:Observation] (94% match)`.
- Expandable rationale card displaying the AI's explanation.
- Option B Collapsible Section: *"Include connected standard entities (X suggested)"* with toggle switches per related class/property.

### 6.3 Detail Panel Semantic Inspector
- Inside the entity detail panel when viewing any class or relation:
  - New card: **"Standard Vocabulary Alignments"**.
  - Asynchronously runs local vector similarity for the active entity.
  - Lists top 3 standard matches with percentage badges.
  - Quick action buttons: **"Map via subClassOf"**, **"Adopt Standard Name"**.

---

## 7. Error Handling, Resilience & Performance

1. **Registry API Downtime**:
   - External registry searches implement a 10s timeout.
   - If registries are offline, the local library remains fully functional with all previously cached ontologies and vectors.
2. **Local Model Caching**:
   - ONNX model is stored in the local cache directory; initial download occurs once and subsequent startups are instantaneous and offline.
3. **Transactional Safety**:
   - Applying drafts with external alignments runs in an isolated database transaction (`db.transaction`).
   - Standard namespace prefixes (`sosa`, `envo`, `qudt`) are preserved for OWL exports and JSON round-trips.

---

## 8. Verification & Testing

1. **Registry Parsing Unit Tests**: Test parsing of mock OLS4 and LOV JSON responses into standard CURIE/IRI/label structures.
2. **Local Vector Engine Unit Tests**: Verify that `getLocalEmbedding` produces expected dimensions and `cosineSimilarity` returns correct rankings for semantic matches (e.g. `"water temperature sampling"` -> `sosa:Sampling`).
3. **Contextual Expansion Tests**: Verify that selecting a class correctly pulls parent and direct relations without duplicate keys.
4. **Integration Tests**: Verify adding a reference ontology, syncing terms, and running `applyOntologyDraft` with alignments.
