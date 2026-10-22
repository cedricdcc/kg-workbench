# Multi-Registry Vocabulary Discovery & Live Endpoint Tester

- **Date:** 2026-10-22
- **Status:** Proposed
- **Scope:** Architectural Subsystem (Reference Vocabularies & Ontology Discovery)

---

## 1. Overview & Problem Statement

KG Workbench grounds ontology authoring, concept alignment, and Competency Question (CQ) validation in standardized semantic vocabularies. Currently, public vocabulary discovery is hardcoded to two external registries: EMBL-EBI OLS4 and Linked Open Vocabularies (LOV).

Recently, the public LOV service (`lov.linkeddata.es`) experienced prolonged downtime, causing search requests to hang until timeout, degrading search speed and rendering general vocabulary discovery unreliable. Furthermore, users require access to wider vocabulary classification schemes (BARTOC), agricultural and biodiversity repositories (AgroPortal, EcoPortal), biomedical repositories (BioPortal), and European public sector classification schemes (EuroVoc / EU Vocabularies SPARQL), as well as custom private endpoints.

This specification introduces:

1. A **Pluggable Multi-Registry Provider Architecture** decoupling vocabulary discovery from any single external API.
2. Concrete adapters for **OLS4**, **BARTOC**, **OntoPortal Alliance** (AgroPortal, BioPortal, EcoPortal), **EU Vocabularies**, a resilient **LOV** circuit breaker, and **Custom REST/SPARQL** endpoints.
3. A resilient **Aggregator Engine** with parallel queries, timeouts, and graceful degradation so failures in one registry never freeze user discovery.
4. An **Endpoint Tester & Registries** UI tab inside the Reference Vocabularies dialog for real-time endpoint probing, latency benchmarking, and raw response inspection.
5. A **Dual-Save Mechanism**:
   - 1-click **"Import to Standards"** saving discovered ontologies and indexing their terms with 384-d vector embeddings in `reference_ontologies` & `reference_ontology_terms`.
   - **"Save Snapshot"** storing full test probe responses in a new `registry_endpoint_snapshots` table for diagnostic history and offline inspection.
6. Unified **Registry API Key Management** persisting keys (for secured portals like BioPortal/AgroPortal) via our existing AES-256-GCM encryption layer.

---

## 2. Architecture & Multi-Registry Provider Subsystem

### 2.1 Provider Interface (`src/features/ontology/server/services/vocabulary-registries/types.ts`)

```typescript
export interface EndpointTestResult {
  ok: boolean
  statusCode: number
  latencyMs: number
  endpointUrl: string
  payloadPreview: unknown
  detectedVocabularies: RegistrySearchResult[]
  error?: string
}

export interface RegistrySearchOptions {
  endpoint?: string
  apiKey?: string
  limit?: number
  timeoutMs?: number
}

export interface RegistryFetchOptions {
  endpoint?: string
  apiKey?: string
  timeoutMs?: number
}

export interface VocabularyRegistryProvider {
  readonly id: string // "ols4" | "bartoc" | "agroportal" | "bioportal" | "ecoportal" | "eu_vocabularies" | "lov" | "custom"
  readonly name: string
  readonly defaultEndpoint: string
  readonly requiresApiKey: boolean
  readonly category:
    "general" | "biomedical" | "agri_eco" | "eu_public" | "iot" | "custom"

  testEndpoint(
    endpoint: string,
    apiKey?: string,
    query?: string
  ): Promise<EndpointTestResult>
  search(
    query: string,
    options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]>
  fetchTerms(
    ontologyId: string,
    options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]>
}
```

### 2.2 Concrete Registry Adapters

Located in `src/features/ontology/server/services/vocabulary-registries/providers/`:

1. **`ols4-provider.ts`**:
   - Default Endpoint: `https://www.ebi.ac.uk/ols4/api`
   - Endpoint probe: Queries `/search?q={query}&type=ontology&rows=5`
   - Terms fetch: Queries `/ontologies/{id}/terms?size=300`
   - Maps OLS docs to standard `RegistrySearchResult` and terms to `RegistryTerm`.

2. **`bartoc-provider.ts`**:
   - Default Endpoint: `https://bartoc.org/api/voc`
   - Endpoint probe: Queries `https://bartoc.org/api/voc?search={query}&limit=10`
   - Response format: JSKOS specification (`prefLabel`, `uri`, `notation`, `scopeNote`, `definition`).
   - Normalizes JSKOS entries into `RegistrySearchResult` with prefix derived from `notation` or URI fragment.

3. **`ontoportal-provider.ts`**:
   - Parameterized factory for:
     - **AgroPortal**: `https://data.agroportal.eu/`
     - **BioPortal**: `https://data.bioontology.org/`
     - **EcoPortal**: `https://data.ecoportal.lifewatch.eu/`
   - Authentication: Injects `Authorization: apikey token={apiKey}` header and `?apikey={apiKey}` query param.
   - Endpoint probe: Queries `/search?q={query}&pagesize=10`.
   - Terms fetch: Queries `/ontologies/{id}/classes` or `/ontologies/{id}/properties`.

4. **`eu-vocabularies-provider.ts`**:
   - Default Endpoint: `https://publications.europa.eu/webapi/rdf/sparql`
   - Queries EU Vocabularies using standard SPARQL 1.1 `SELECT` query against SKOS concept schemes:
     ```sparql
     PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
     SELECT DISTINCT ?concept ?prefLabel ?definition WHERE {
       ?concept a skos:Concept ;
                skos:prefLabel ?prefLabel .
       OPTIONAL { ?concept skos:definition ?definition }
       FILTER (regex(str(?prefLabel), "{query}", "i"))
     } LIMIT 15
     ```

5. **`lov-provider.ts`**:
   - Default Endpoint: `https://lov.linkeddata.es/dataset/api/v2`
   - Resilient Circuit Breaker: Wrapped in an `AbortController` with a 3-second hard timeout. If unreachable or failing consecutive attempts, sets circuit state to `OPEN`, immediately returning empty results without blocking searches until a cooldown period passes.

6. **`custom-provider.ts`**:
   - Supports arbitrary REST or SPARQL endpoint URLs input by the user, detecting JSON or SPARQL results formats.

### 2.3 Resilient Aggregator Engine (`src/features/ontology/server/services/vocabulary-registries/aggregator.ts`)

```typescript
export async function searchAllRegistries(
  query: string,
  options?: {
    enabledProviderIds?: string[]
    timeoutMs?: number
  }
): Promise<{
  results: RegistrySearchResult[]
  failedProviders: Array<{ providerId: string; error: string }>
}>
```

- Executes queries across all requested providers concurrently using `Promise.allSettled`.
- Combines and deduplicates results by prefix.
- Returns partial successes immediately with a list of any failed providers for non-blocking UI notifications.

---

## 3. Data Model & Persistence

### 3.1 Endpoint Snapshots Table (`src/server/db/schema.ts`)

```typescript
export const registryEndpointSnapshots = pgTable(
  "registry_endpoint_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    group_key: text("group_key").notNull().default("shared"),
    provider_id: text("provider_id").notNull(),
    endpoint_url: text("endpoint_url").notNull(),
    status_code: integer("status_code").notNull(),
    latency_ms: integer("latency_ms").notNull(),
    query_params: text("query_params"),
    response_payload: text("response_payload").notNull(),
    detected_vocab_count: integer("detected_vocab_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
)
```

### 3.2 Registry API Key Storage

- Updates `SupportedProvider` in `src/features/settings/server/types.ts` to allow `"bioportal" | "agroportal" | "ecoportal" | string`.
- API keys are stored encrypted via existing `user_api_keys` using AES-256-GCM.
- Resolution falls back to environment variables: `BIOPORTAL_API_KEY`, `AGROPORTAL_API_KEY`.

---

## 4. UI Components & User Flow

### 4.1 Updated `ReferenceVocabulariesDialog`

The dialog tabs become:

1. **Workspace Library**: Existing installed reference ontologies.
2. **Search & Add**: Multi-registry search with provider filter badges.
3. **Endpoint Tester & Registries**: Live diagnostic & discovery workbench.
4. **Upload File / URL**: Direct TTL/RDF upload.

### 4.2 Endpoint Tester Tab (`src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/`)

- **`registry-preset-selector.tsx`**: Quick-select buttons for BARTOC, OLS4, AgroPortal, BioPortal, EcoPortal, EU Vocabularies, LOV, and Custom.
- **`endpoint-probe-form.tsx`**:
  - Endpoint URL input.
  - API key input with show/hide toggle and a "Save Key" button.
  - Test query input (defaults to e.g. `sosa` or `sensor`).
  - "Test Probe" action with loading spinner.
- **`probe-metrics-bar.tsx`**:
  - HTTP Status pill (`200 OK`, `401 Unauthorized`, etc.).
  - Latency pill (`190 ms`).
  - Detected Vocabularies count badge.
- **`probe-results-panel.tsx`** (Two-column layout):
  - **Left Column (Detected Vocabularies)**: Cards for each detected ontology with Prefix, Title, Base IRI, and a 1-click **"Import to Standards"** button.
  - **Right Column (Response Inspector)**:
    - Formatted, scrollable JSON/RDF viewer.
    - **"Copy Payload"** and **"Save Snapshot"** action buttons.
    - Collapsible **"Saved Snapshots"** drawer showing past runs with 1-click re-inspection and delete.

### 4.3 Multi-Registry `VocabularySearchTab`

- Adds filter pills: `[All] [OLS4] [BARTOC] [AgroPortal] [BioPortal] [EU Vocabularies]`.
- Displays source badges on results (`OLS4`, `BARTOC`, etc.).
- Displays non-blocking warning toast if a specific registry timed out while displaying the healthy results.

---

## 5. Server Actions

Located in `src/features/ontology/server/actions/reference-vocabularies.ts`:

1. `testRegistryEndpoint(input: { providerId: string; endpointUrl: string; apiKey?: string; testQuery?: string }): Promise<EndpointTestResult>`
2. `saveEndpointSnapshot(input: { providerId: string; endpointUrl: string; statusCode: number; latencyMs: number; queryParams?: string; responsePayload: string; detectedVocabCount: number }): Promise<{ id: string }>`
3. `getEndpointSnapshots(providerId?: string): Promise<Array<SnapshotSummary>>`
4. `deleteEndpointSnapshot(snapshotId: string): Promise<void>`
5. `saveRegistryApiKey(provider: string, apiKey: string): Promise<void>`

---

## 6. Error Handling & Edge Cases

- **Third-Party Hangs**: 4-second timeout on all provider network calls.
- **HTML/Proxy Error Payloads**: Safe detection of non-JSON responses before parsing.
- **Unauthorized Access**: Probing BioPortal/AgroPortal without a key produces a clean 401 status with clear instructions to provide an API key.
- **Prefix Collisions**: Results from multiple registries with the same prefix are merged cleanly, preferring the entry with the richest description.
- **Database Isolation**: All snapshots and reference ontologies respect `group_key` multi-tenancy.

---

## 7. Verification & Testing

- **Unit Tests**:
  - `bartoc-provider.test.ts`: JSKOS parsing and search result transformation.
  - `ontoportal-provider.test.ts`: Header handling and query formation.
  - `lov-provider.test.ts`: Circuit breaker and timeout simulation.
  - `aggregator.test.ts`: Parallel querying, deduplication, and partial failure handling.
- **Snapshot Database Tests**:
  - Test snapshot insert, retrieval, and deletion.
- **UI Component Tests**:
  - Test preset selection, live probe simulation, snapshot save, and import triggers.
