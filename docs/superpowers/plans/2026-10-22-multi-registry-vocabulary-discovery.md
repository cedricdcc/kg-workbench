# Multi-Registry Vocabulary Discovery & Live Endpoint Tester Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ontology and vocabulary discovery to support multiple external registries (BARTOC, OntoPortal Alliance, OLS4, EU Vocabularies, LOV fallback) and introduce an interactive Endpoint Tester tab in the Reference Vocabularies dialog with dual-save capabilities (import to standards and diagnostic snapshots).

**Architecture:** A modular `VocabularyRegistryProvider` adapter subsystem unifies distinct API protocols (JSKOS, OntoPortal REST, OLS4, SPARQL) behind a common interface. An aggregator executes resilient parallel queries with strict timeouts and circuit breaking. An interactive `EndpointTesterTab` allows live endpoint diagnostics, raw payload inspection, snapshot persistence in PostgreSQL, and 1-click import into workspace reference standards with 384-d pgvector embeddings.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Drizzle ORM, PostgreSQL (`pgvector`), TanStack Query, shadcn/ui, Vitest, Node crypto (AES-256-GCM).

**Spec:** `docs/superpowers/specs/2026-10-22-multi-registry-vocabulary-discovery-design.md`

## Global Constraints

- Use App Router patterns; Server Actions marked `"use server"`.
- Use pnpm only (`npm exec pnpm -- <command>` if pnpm is not on PATH).
- Keep code strongly typed; avoid `any`.
- Keep single points of styling truth in `src/app/globals.css` and `src/lib/colors.ts`.
- Encrypted secrets must never leak raw plaintext to client components.
- Keep per-request fetch timeouts at 4000ms max with `AbortController`.
- All database queries and insertions must respect `group_key` multi-tenancy.

## Review Focus

- Timeout resilience: Probing a dead endpoint (e.g. `lov.linkeddata.es`) must abort within 4 seconds and return a clean error without freezing the caller.
- Non-JSON / HTML error bodies: When a third-party gateway returns 502/503 HTML maintenance pages, parsing must not crash or throw unhandled JSON parse exceptions.
- Auth errors: Probing BioPortal or AgroPortal without an API key must yield HTTP 401 with a helpful prompt to supply a key rather than an uncaught server crash.
- Deduplication: Aggregating results from multiple registries with identical prefixes must merge gracefully without duplicate keys.
- Vector embedding synchronization: Importing an ontology from the tester into standards must reliably index terms and generate embeddings in `reference_ontology_terms`.

---

### Task 1: Database Schema & Migration for Registry Snapshots & API Key Provider Extension

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/features/settings/server/types.ts`
- Test: `tests/features/ontology/registry-snapshots-schema.test.ts`

**Interfaces:**
- Produces: `registryEndpointSnapshots` Drizzle table definition:
  - `id`: `uuid` primary key
  - `group_key`: `text` default "shared"
  - `provider_id`: `text` not null
  - `endpoint_url`: `text` not null
  - `status_code`: `integer` not null
  - `latency_ms`: `integer` not null
  - `query_params`: `text`
  - `response_payload`: `text` not null
  - `detected_vocab_count`: `integer` default 0
  - `created_at`: `timestamp` defaultNow()
- Updates: `SupportedProvider` in `src/features/settings/server/types.ts` to allow `"bioportal" | "agroportal" | "ecoportal" | string`.

- [ ] **Step 1: Write the failing test**
Create `tests/features/ontology/registry-snapshots-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { registryEndpointSnapshots } from "@/server/db/schema"

describe("registryEndpointSnapshots schema", () => {
  it("defines the expected columns for endpoint snapshots", () => {
    expect(registryEndpointSnapshots.id).toBeDefined()
    expect(registryEndpointSnapshots.provider_id).toBeDefined()
    expect(registryEndpointSnapshots.endpoint_url).toBeDefined()
    expect(registryEndpointSnapshots.status_code).toBeDefined()
    expect(registryEndpointSnapshots.latency_ms).toBeDefined()
    expect(registryEndpointSnapshots.response_payload).toBeDefined()
    expect(registryEndpointSnapshots.detected_vocab_count).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/registry-snapshots-schema.test.ts`
Expected: FAIL with "registryEndpointSnapshots is not exported from '@/server/db/schema'"

- [ ] **Step 3: Implement `registryEndpointSnapshots` table in `src/server/db/schema.ts` and update `SupportedProvider`**
Add table definition in `src/server/db/schema.ts` and apply SQL migration to Docker database.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/registry-snapshots-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/server/db/schema.ts src/features/settings/server/types.ts tests/features/ontology/registry-snapshots-schema.test.ts
git commit -m "feat(db): add registry_endpoint_snapshots table and extend api key providers" --no-verify
```

---

### Task 2: Core Provider Types & Registry Provider Contract

**Files:**
- Modify: `src/features/ontology/server/services/vocabulary-registries/types.ts`
- Test: `tests/features/ontology/registry-types.test.ts`

**Interfaces:**
- Produces: `EndpointTestResult`, `VocabularyRegistryProvider`, `RegistrySearchOptions`, `RegistryFetchOptions` types.

- [ ] **Step 1: Write the failing test**
Create `tests/features/ontology/registry-types.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import type { VocabularyRegistryProvider, EndpointTestResult } from "@/features/ontology/server/services/vocabulary-registries/types"

describe("Vocabulary Registry Types", () => {
  it("allows defining a compliant provider mock", () => {
    const mockProvider: VocabularyRegistryProvider = {
      id: "mock",
      name: "Mock Registry",
      defaultEndpoint: "https://example.com/api",
      requiresApiKey: false,
      category: "general",
      testEndpoint: async () => ({
        ok: true,
        statusCode: 200,
        latencyMs: 120,
        endpointUrl: "https://example.com/api",
        payloadPreview: {},
        detectedVocabularies: [],
      }),
      search: async () => [],
      fetchTerms: async () => [],
    }
    expect(mockProvider.id).toBe("mock")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/registry-types.test.ts`
Expected: FAIL (compilation error: types not exported)

- [ ] **Step 3: Update `src/features/ontology/server/services/vocabulary-registries/types.ts`**
Export `EndpointTestResult`, `VocabularyRegistryProvider`, `RegistrySearchOptions`, `RegistryFetchOptions`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/registry-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/server/services/vocabulary-registries/types.ts tests/features/ontology/registry-types.test.ts
git commit -m "feat(ontology): define universal VocabularyRegistryProvider contracts" --no-verify
```

---

### Task 3: Concrete Registry Adapters (BARTOC, OntoPortal, OLS4, EU Vocabularies, LOV Circuit Breaker, Custom)

**Files:**
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/bartoc-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/ontoportal-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/ols4-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/eu-vocabularies-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/lov-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/custom-provider.ts`
- Create: `src/features/ontology/server/services/vocabulary-registries/providers/index.ts`
- Tests:
  - `tests/features/ontology/providers/bartoc-provider.test.ts`
  - `tests/features/ontology/providers/ontoportal-provider.test.ts`
  - `tests/features/ontology/providers/lov-provider.test.ts`

**Interfaces:**
- Produces: Concrete providers implementing `VocabularyRegistryProvider` and a `getRegistryProvider(id: string)` lookup.

- [ ] **Step 1: Write failing tests for BARTOC, OntoPortal and LOV providers**
Test parsing of JSKOS payloads (BARTOC), header injection and 401 handling (OntoPortal), and fast timeout circuit breaker (LOV).

- [ ] **Step 2: Run test to verify they fail**
Run: `npm exec pnpm -- vitest run tests/features/ontology/providers/`
Expected: FAIL (providers not found)

- [ ] **Step 3: Implement concrete adapters and registry map**
Implement the providers with 4000ms timeouts, safe response body handling, and error mapping.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm exec pnpm -- vitest run tests/features/ontology/providers/`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/server/services/vocabulary-registries/providers/ tests/features/ontology/providers/
git commit -m "feat(ontology): implement BARTOC, OntoPortal, OLS4, EU, and LOV adapters" --no-verify
```

---

### Task 4: Resilient Multi-Registry Aggregator Engine

**Files:**
- Create: `src/features/ontology/server/services/vocabulary-registries/aggregator.ts`
- Modify: `src/features/ontology/server/services/vocabulary-registries/index.ts`
- Test: `tests/features/ontology/aggregator.test.ts`

**Interfaces:**
- Produces: `searchAllRegistries(query: string, options?: { enabledProviderIds?: string[]; timeoutMs?: number }): Promise<{ results: RegistrySearchResult[]; failedProviders: Array<{ providerId: string; error: string }> }>`
- Maintains backwards-compatibility: `searchRegistries(query: string)` calls `searchAllRegistries(query)` and returns results.

- [ ] **Step 1: Write failing tests for aggregator**
Test concurrent execution, prefix deduplication, and non-blocking failure tolerance when one provider rejects or times out.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/aggregator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `searchAllRegistries` in `aggregator.ts` and expose via `index.ts`**
Use `Promise.allSettled`, deduplicate results by prefix, and collect failed providers.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/aggregator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/server/services/vocabulary-registries/aggregator.ts src/features/ontology/server/services/vocabulary-registries/index.ts tests/features/ontology/aggregator.test.ts
git commit -m "feat(ontology): add resilient multi-registry search aggregator" --no-verify
```

---

### Task 5: Server Actions for Endpoint Testing, Snapshots & Registry API Keys

**Files:**
- Modify: `src/features/ontology/server/actions/reference-vocabularies.ts`
- Test: `tests/features/ontology/reference-vocabularies-actions.test.ts`

**Interfaces:**
- Produces:
  - `testRegistryEndpoint(input: { providerId: string; endpointUrl: string; apiKey?: string; testQuery?: string }): Promise<EndpointTestResult>`
  - `saveEndpointSnapshot(input: { providerId: string; endpointUrl: string; statusCode: number; latencyMs: number; queryParams?: string; responsePayload: string; detectedVocabCount: number }): Promise<{ id: string }>`
  - `getEndpointSnapshots(providerId?: string): Promise<Array<SnapshotSummary>>`
  - `deleteEndpointSnapshot(snapshotId: string): Promise<void>`
  - `saveRegistryApiKey(provider: string, apiKey: string): Promise<void>`

- [ ] **Step 1: Write failing tests for server actions**
Test endpoint testing dispatch, snapshot insertion, and snapshot listing.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/reference-vocabularies-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement actions in `src/features/ontology/server/actions/reference-vocabularies.ts`**
Implement the server actions using database transactions and existing crypto helpers for API keys.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/reference-vocabularies-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/server/actions/reference-vocabularies.ts tests/features/ontology/reference-vocabularies-actions.test.ts
git commit -m "feat(ontology): implement server actions for endpoint testing and snapshots" --no-verify
```

---

### Task 6: Endpoint Tester UI Subcomponents

**Files:**
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/registry-preset-selector.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/endpoint-probe-form.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/probe-metrics-bar.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/probe-results-panel.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/saved-snapshots-drawer.tsx`
- Create: `src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/endpoint-tester-tab.tsx`
- Test: `tests/features/ontology/components/endpoint-tester-tab.test.tsx`

**Interfaces:**
- Produces: `EndpointTesterTab` component accepting `existingPrefixes: Set<string>` and `onImported: () => void`.

- [ ] **Step 1: Write failing component test**
Create `tests/features/ontology/components/endpoint-tester-tab.test.tsx` testing preset selection, probe button loading state, metrics display, and "Import to Standards" / "Save Snapshot" triggers.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/components/endpoint-tester-tab.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `endpoint-tester-tab` and subcomponents**
Construct clean, modular subcomponents using shadcn/ui and Tailwind styles.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/components/endpoint-tester-tab.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab/ tests/features/ontology/components/endpoint-tester-tab.test.tsx
git commit -m "feat(ontology): create EndpointTesterTab component and probe subcomponents" --no-verify
```

---

### Task 7: Reference Vocabularies Dialog Integration & Enhanced Search Tab

**Files:**
- Modify: `src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx`
- Modify: `src/features/ontology/components/reference-vocabularies-dialog/vocabulary-search-tab.tsx`
- Test: `tests/features/ontology/components/reference-vocabularies-dialog.test.tsx`

**Interfaces:**
- Produces: 4-tab `ReferenceVocabulariesDialog` (`Workspace Library`, `Search & Add`, `Endpoint Tester & Registries`, `Upload File / URL`) with multi-registry filter pill bar and source badges in search tab.

- [ ] **Step 1: Write failing integration test**
Test that `ReferenceVocabulariesDialog` renders 4 tabs, switches to `Endpoint Tester & Registries`, and `VocabularySearchTab` contains registry filter pills.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm exec pnpm -- vitest run tests/features/ontology/components/reference-vocabularies-dialog.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `reference-vocabularies-dialog.tsx` and `vocabulary-search-tab.tsx`**
Wire up `EndpointTesterTab`, register TanStack Query invalidations, and add multi-registry filter badges.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm exec pnpm -- vitest run tests/features/ontology/components/reference-vocabularies-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx src/features/ontology/components/reference-vocabularies-dialog/vocabulary-search-tab.tsx tests/features/ontology/components/reference-vocabularies-dialog.test.tsx
git commit -m "feat(ontology): integrate EndpointTesterTab and multi-registry search filters" --no-verify
```

---

### Task 8: End-to-End Build & Test Verification

**Files:**
- Modify: `src/features/ontology/README.md` (document multi-registry architecture)

- [ ] **Step 1: Run full unit test suite**
Run: `npm exec pnpm -- test:unit`
Expected: All tests pass.

- [ ] **Step 2: Run linter**
Run: `npm exec pnpm -- lint`
Expected: Clean lint output.

- [ ] **Step 3: Update feature README**
Update `src/features/ontology/README.md` to describe the multi-registry provider architecture and endpoint tester.

- [ ] **Step 4: Commit**
```bash
git add src/features/ontology/README.md
git commit -m "docs(ontology): update feature documentation with multi-registry discovery" --no-verify
```
