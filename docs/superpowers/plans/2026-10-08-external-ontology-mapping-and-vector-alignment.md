# External Ontology Mapping & Local Vector Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable discovery, local zero-cost vector indexing, and AI-assisted alignment of standard external ontologies (e.g. SOSA, ENVO, Darwin Core, QUDT) to ground ontology generation and answer Competency Questions.

**Architecture:** A PostgreSQL cache for registered external ontologies and terms, public REST connectors to EBI OLS4 and LOV, an in-process local vector embedding/cosine engine (using zero API tokens), AI prompt pre-filtering for grounded CQ alignment with rationales, contextual graph expansion (Option B), and an interactive UI library and semantic inspector.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL (via Drizzle ORM), `@xenova/transformers` (local in-process CPU embeddings), Tailwind CSS, Radix UI / shadcn, TanStack Query.

**Spec:** [docs/superpowers/specs/2026-10-08-external-ontology-mapping-and-vector-alignment-design.md](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-10-08-external-ontology-mapping-and-vector-alignment-design.md)

## Global Constraints

- Never consume external LLM credits (Gemini / OpenAI) for embeddings; all vector embeddings must run locally and cost $0.00.
- All public registry calls (OLS4 / LOV) must run server-side with a 10s abort timeout and fail gracefully if unreachable.
- Workspace data isolation must be enforced: all reference ontologies and terms must belong to `group_key`.
- Use `pnpm` only (via `npm exec pnpm -- <command>` on Windows).
- Use `--no-verify` on git commits to bypass husky in subshells.

## Review Focus

1. Registry responses with missing labels, IRIs, or parent relationships: normalizer must supply valid fallbacks without throwing.
2. Embedding vector dimensions mismatch: similarity engine must enforce identical vector lengths before dot-product.
3. Offline or registry timeout states: UI must show clear error notifications without disrupting existing cached library terms.
4. Circular parent or relational loops during contextual graph expansion (Option B): expansion logic must track visited IRIs in a `Set` to prevent infinite loops.
5. Ingestion of large ontologies: registry fetching must limit max terms to 500 per ontology to keep indexing fast and responsive.

---

### Task 1: Reference Ontologies Database Schema & Migration

**Files:**
- Modify: `src/server/db/schema.ts`
- Test: `tests/reference-ontologies-schema.test.ts`

**Interfaces:**
- Produces: `referenceOntologies`, `referenceOntologyTerms` table definitions in Drizzle ORM.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reference-ontologies-schema.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { referenceOntologies, referenceOntologyTerms } from "../src/server/db/schema"

test("referenceOntologies schema exposes expected columns", () => {
  assert.ok(referenceOntologies.prefix)
  assert.ok(referenceOntologies.base_iri)
  assert.ok(referenceOntologies.source_registry)
  assert.ok(referenceOntologies.group_key)
})

test("referenceOntologyTerms schema exposes expected columns", () => {
  assert.ok(referenceOntologyTerms.curie)
  assert.ok(referenceOntologyTerms.iri)
  assert.ok(referenceOntologyTerms.label)
  assert.ok(referenceOntologyTerms.embedding)
  assert.ok(referenceOntologyTerms.parent_iris)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reference-ontologies-schema.test.ts`
Expected: FAIL (Cannot find export `referenceOntologies`).

- [ ] **Step 3: Define `referenceOntologies` and `referenceOntologyTerms` in `src/server/db/schema.ts`**

Add table definitions:
- `referenceOntologies`: `id`, `prefix`, `name`, `base_iri`, `source_registry`, `source_id`, `version`, `synced_at`, `group_key`, `created_at`.
- `referenceOntologyTerms`: `id`, `reference_ontology_id`, `curie`, `iri`, `label`, `type`, `description`, `synonyms`, `parent_iris`, `related_property_iris`, `embedding` (`real("embedding").array()`), `group_key`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reference-ontologies-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts tests/reference-ontologies-schema.test.ts
git commit -m "feat(ontology): add reference ontologies and terms schema" --no-verify
```

---

### Task 2: Public Registry Clients (OLS4 & LOV)

**Files:**
- Create: `src/features/ontology/server/services/vocabulary-registries/types.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/ols4-client.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/lov-client.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/index.ts`
- Test: `tests/vocabulary-registries.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type RegistrySearchResult = {
    source: "ols" | "lov"
    sourceId: string
    prefix: string
    name: string
    description: string
    baseIri: string
  }
  export type RegistryTerm = {
    curie: string
    iri: string
    label: string
    type: "class" | "property" | "individual"
    description: string
    synonyms: string[]
    parentIris: string[]
    relatedPropertyIris: string[]
  }
  export function searchRegistries(query: string): Promise<RegistrySearchResult[]>
  export function fetchRegistryTerms(source: "ols" | "lov", sourceId: string): Promise<RegistryTerm[]>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/vocabulary-registries.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { parseOlsTerm, parseLovTerm } from "../src/features/ontology/server/services/vocabulary-registries"

test("parseOlsTerm extracts canonical curie, label, and parent IRIs", () => {
  const raw = {
    obo_id: "SOSA:Observation",
    iri: "http://www.w3.org/ns/sosa/Observation",
    label: "Observation",
    description: ["Act of observing a property."],
    synonyms: ["Measurement"],
    in_defining_ontology: true,
  }
  const parsed = parseOlsTerm(raw)
  assert.equal(parsed.curie, "sosa:Observation")
  assert.equal(parsed.label, "Observation")
  assert.equal(parsed.description, "Act of observing a property.")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/vocabulary-registries.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement OLS4 and LOV registry clients**

- `ols4-client.ts`: Fetch from `https://www.ebi.ac.uk/ols4/api/search?q={query}&type=ontology` and `https://www.ebi.ac.uk/ols4/api/ontologies/{id}/terms`.
- `lov-client.ts`: Fetch from `https://lov.linkeddata.es/dataset/lov/api/v2/vocabulary/search` and term APIs.
- Normalizers with 10s `AbortController` timeout.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/vocabulary-registries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/services/vocabulary-registries/ tests/vocabulary-registries.test.ts
git commit -m "feat(ontology): add OLS4 and LOV registry connectors" --no-verify
```

---

### Task 3: Local Zero-Cost Vector Embedder & In-Memory Cosine Similarity Engine

**Files:**
- Create: `src/server/embedding/local-embedder.ts`
- Create: `src/features/ontology/server/services/vector-similarity.ts`
- Test: `tests/vector-similarity.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function getLocalEmbedding(text: string): Promise<number[]>
  export function getLocalBatchEmbeddings(texts: string[]): Promise<number[][]>
  export function cosineSimilarity(a: number[], b: number[]): number
  export function rankTermsBySimilarity(queryVector: number[], terms: Array<{ curie: string, embedding: number[] }>): Array<{ curie: string, similarity: number }>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/vector-similarity.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { cosineSimilarity, rankTermsBySimilarity } from "../src/features/ontology/server/services/vector-similarity"

test("cosineSimilarity returns 1.0 for identical normalized vectors", () => {
  const v1 = [1, 0, 0]
  const v2 = [1, 0, 0]
  assert.equal(Math.round(cosineSimilarity(v1, v2) * 100) / 100, 1.0)
})

test("cosineSimilarity returns 0.0 for orthogonal vectors", () => {
  const v1 = [1, 0]
  const v2 = [0, 1]
  assert.equal(cosineSimilarity(v1, v2), 0)
})

test("rankTermsBySimilarity sorts candidate terms descending by score", () => {
  const query = [1, 1]
  const candidates = [
    { curie: "envo:001", embedding: [0, 1] },
    { curie: "sosa:Observation", embedding: [1, 1] },
  ]
  const ranked = rankTermsBySimilarity(query, candidates)
  assert.equal(ranked[0].curie, "sosa:Observation")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/vector-similarity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement local embedder and vector similarity**

- `local-embedder.ts`: Uses `@xenova/transformers` with `feature-extraction` pipeline (`all-MiniLM-L6-v2`) or local Ollama fallback.
- `vector-similarity.ts`: Cosine similarity calculation using Float32Array and descending ranking.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/vector-similarity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/embedding/local-embedder.ts src/features/ontology/server/services/vector-similarity.ts tests/vector-similarity.test.ts
git commit -m "feat(ontology): add local zero-cost embedding and cosine similarity engine" --no-verify
```

---

### Task 4: Reference Vocabularies Sync & Query Layer

**Files:**
- Create: `src/features/ontology/server/queries/reference-vocabularies.ts`
- Create: `src/features/ontology/server/actions/reference-vocabularies.ts`
- Test: `tests/reference-vocabularies-actions.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function getReferenceOntologies(): Promise<ReferenceOntologySummary[]>
  export async function addReferenceOntology(input: AddReferenceOntologyInput): Promise<ReferenceOntologySummary>
  export async function syncReferenceOntology(id: string): Promise<SyncResult>
  export async function deleteReferenceOntology(id: string): Promise<void>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reference-vocabularies-actions.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { addReferenceOntology } from "../src/features/ontology/server/actions/reference-vocabularies"

test("addReferenceOntology rejects invalid or empty prefix", async () => {
  await assert.rejects(
    () => addReferenceOntology({ prefix: "", name: "Test", baseIri: "http://example.org/", sourceRegistry: "ols", sourceId: "test" }),
    /Prefix is required/
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reference-vocabularies-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement actions & queries**

Implement `addReferenceOntology`, `syncReferenceOntology` (fetches registry terms, computes local embeddings, saves to DB), `deleteReferenceOntology`, and `getReferenceOntologies`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/reference-vocabularies-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/queries/reference-vocabularies.ts src/features/ontology/server/actions/reference-vocabularies.ts tests/reference-vocabularies-actions.test.ts
git commit -m "feat(ontology): implement reference vocabularies sync and actions" --no-verify
```

---

### Task 5: AI Prompt Grounding & Contextual Graph Expansion (Option B)

**Files:**
- Modify: `src/features/ontology/schemas/ai-generation.ts`
- Modify: `src/features/ontology/server/services/ai-ontology-generator/prompt-builder.ts`
- Create: `src/features/ontology/server/services/ai-ontology-generator/contextual-expansion.ts`
- Modify: `src/features/ontology/server/actions/generate-ontology.ts`
- Test: `tests/ai-ontology-alignment.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export const EntityAlignmentSchema = z.object({
    mode: z.enum(["reuse", "subClassOf", "equivalentClass"]),
    targetCurie: z.string(),
    targetIri: z.string(),
    similarityScore: z.number().optional(),
    rationale: z.string(),
  })
  export function expandContextualConnections(
    adoptedTerms: string[],
    referenceTerms: RegistryTerm[]
  ): ContextualExpansionResult
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ai-ontology-alignment.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { expandContextualConnections } from "../src/features/ontology/server/services/ai-ontology-generator/contextual-expansion"

test("expandContextualConnections discovers parent classes and direct properties without cycle loops", () => {
  const catalog = [
    {
      curie: "sosa:Observation",
      iri: "http://www.w3.org/ns/sosa/Observation",
      parentIris: ["http://www.w3.org/ns/sosa/FeatureOfInterest"],
      relatedPropertyIris: ["http://www.w3.org/ns/sosa/hasFeatureOfInterest"],
    },
    {
      curie: "sosa:FeatureOfInterest",
      iri: "http://www.w3.org/ns/sosa/FeatureOfInterest",
      parentIris: [],
      relatedPropertyIris: [],
    },
  ]
  const expanded = expandContextualConnections(["sosa:Observation"], catalog as any)
  assert.equal(expanded.suggestedParents.length, 1)
  assert.equal(expanded.suggestedParents[0].curie, "sosa:FeatureOfInterest")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/ai-ontology-alignment.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement prompt grounding and contextual expansion**

- In `ai-generation.ts`: Add `alignment` field to `GeneratedClassSchema` and `GeneratedRelationSchema`.
- In `prompt-builder.ts`: Inject candidate reference terms and alignment guidelines.
- In `contextual-expansion.ts`: Resolve parent classes and linked relations with cycle-safe `Set`.
- In `generate-ontology.ts`: Pre-filter CQs with local vector search and expand contextual relations.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/ai-ontology-alignment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/schemas/ai-generation.ts src/features/ontology/server/services/ai-ontology-generator/ tests/ai-ontology-alignment.test.ts
git commit -m "feat(ontology): ground AI generation in reference vocabularies with contextual expansion" --no-verify
```

---

### Task 6: Reference Vocabularies Dialog & Header Trigger UI

**Files:**
- Create: `src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/vocabulary-search-tab.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/vocabulary-library-tab.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`

- [ ] **Step 1: Write component structure with search tab and library tab**
- [ ] **Step 2: Hook up registry search with loading states and "Add to Workspace"**
- [ ] **Step 3: Hook up library list with "Refetch / Sync" and "Remove" mutations**
- [ ] **Step 4: Add "Vocabularies" button in `OntologyHeader`**
- [ ] **Step 5: Run typecheck and lint to verify zero errors**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/components/reference-vocabularies-dialog/ src/features/ontology/components/ontology-header/
git commit -m "feat(ontology): add reference vocabularies management modal and header action" --no-verify
```

---

### Task 7: AI Review Modal Grounding Badges, Rationales & Option B Graph Closure

**Files:**
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-review-step.tsx`
- Create: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/contextual-expansion-section.tsx`

- [ ] **Step 1: Display standard vocabulary badge (`[sosa:Observation]`) next to classes and relations**
- [ ] **Step 2: Add expandable semantic rationale card explaining why the term answers the CQ**
- [ ] **Step 3: Implement Option B collapsible section: "Suggested Contextual Standard Connections" with toggle checkboxes**
- [ ] **Step 4: Verify review step filtering includes selected contextual entities on Apply**
- [ ] **Step 5: Run typecheck and tests**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/
git commit -m "feat(ontology): display semantic alignments, rationales, and contextual graph closure in review step" --no-verify
```

---

### Task 8: Detail Panel Semantic Inspector ("Standard Vocabulary Alignments")

**Files:**
- Create: `src/features/ontology/components/detail-panel/shared/semantic-alignments-card.tsx`
- Modify: `src/features/ontology/components/detail-panel/class-detail.tsx`
- Modify: `src/features/ontology/components/detail-panel/relation-detail.tsx`

- [ ] **Step 1: Create `SemanticAlignmentsCard` querying local vector similarity for the active entity**
- [ ] **Step 2: Render top 3 nearest standard matches with similarity score badges**
- [ ] **Step 3: Add interactive "Map as subClassOf" and "Adopt Standard Term" buttons with toast feedback**
- [ ] **Step 4: Embed card in class and relation detail panels**
- [ ] **Step 5: Run full test suite, lint, and typecheck**

Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec tsx -- --conditions=react-server --test tests/*.test.ts`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- typecheck`
Run: `$env:PATH += ";C:\Program Files\nodejs"; npm exec pnpm -- lint`
- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/components/detail-panel/
git commit -m "feat(ontology): add semantic alignments inspector card to class and relation detail panels" --no-verify
```
