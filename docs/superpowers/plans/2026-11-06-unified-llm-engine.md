# Unified TypeScript LLM Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standardized, modular TypeScript LLM engine (`src/server/llm/`) supporting Google Gemini (with dynamic model aliasing and multi-model fallback) and OpenAI-compatible endpoints (vLLM), integrate vLLM into Settings UI, modernize Ontology generation UI, and refactor all existing LLM callers.

**Architecture:** A centralized `LlmClient` in `src/server/llm/` provides typed `generateText()` and `generateStructured<T>()` with intra-provider candidate model fallback (auto-recovering from 404, 503, 429, and schema errors). Domain features (Tabular mapping synthesis, Ontology generation, Relation reconciliation, and API Key testing) delegate entirely to this engine, eliminating brittle raw fetches and duplicate fallback loops.

**Tech Stack:** TypeScript, Next.js App Router (Server Actions), Zod, Node.js crypto, Google Gemini REST API (v1beta), OpenAI-compatible REST API (/v1), Tailwind CSS / shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-11-06-unified-llm-engine-design.md`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-11-06-unified-llm-engine-design.md)

## Global Constraints

- Use `pnpm` only (or `npm exec pnpm -- <cmd>` on Windows).
- Maintain documentation integrity: preserve all existing comments and docstrings.
- Code must be strongly typed with strict TypeScript and ESLint compliance; avoid `any`.
- All credentials and sensitive API keys must remain server-side only; never expose them to client components or log them in traces.
- Fallback is strictly intra-provider: selecting Gemini cycles Gemini candidates (`gemini-3.8-flash` -> `gemini-2.5-pro` -> `gemini-1.5-flash`); selecting vLLM targets the configured vLLM instance.

## Review Focus

1. **Deprecated/Retired Model Aliasing**: A caller requests `gemini-2.5-flash` or `gemini-2.0-flash`; the engine normalizes to `gemini-3.8-flash` instead of returning 404.
2. **Schema Failure Candidate Advance**: An LLM returns invalid JSON or schema-mismatched data during `generateStructured()`; the engine logs a `schema_error` and tries the next candidate model in the queue rather than crashing the caller.
3. **Fail-Fast on Bad Credentials**: Upstream returns 401 Unauthorized or 403 Forbidden; the engine throws immediately without burning retries across the remaining candidate models.
4. **vLLM Cache Efficiency**: Multiple calls to vLLM reuse cached `/v1/models` discovery within 5 minutes without making redundant network requests on every prompt.
5. **Clean Markdown Fence Stripping**: Raw LLM output wrapped in `json ... ` or `...` markdown fences parses cleanly into the validated schema object.

---

### Task 1: LLM Engine Types & Model Catalog

**Files:**

- Create: `src/server/llm/types.ts`
- Create: `src/server/llm/catalog.ts`
- Test: `tests/llm-catalog.test.ts`

**Interfaces:**

- Consumes: Nothing
- Produces:
  - `export type SupportedLlmProvider = "gemini" | "vllm" | "openai"`
  - `export interface LlmPrompt { systemPrompt?: string; userPrompt: string }`
  - `export interface LlmGenerateOptions { ... }`
  - `export interface LlmStructuredOptions<T> { ... }`
  - `export interface LlmExecutionTrace { ... }`
  - `export function normalizeModelName(provider: SupportedLlmProvider, model?: string): string`
  - `export function getCandidateModels(provider: SupportedLlmProvider, primaryModel?: string, customCandidates?: string[]): string[]`

- [ ] **Step 1: Write the failing tests for catalog and model normalization**

Create `tests/llm-catalog.test.ts`:

```typescript
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeModelName,
  getCandidateModels,
} from "../src/server/llm/catalog"

test("normalizeModelName normalizes legacy Gemini flash models to gemini-3.8-flash", () => {
  assert.equal(
    normalizeModelName("gemini", "gemini-2.5-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "models/gemini-2.5-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "gemini-2.0-flash"),
    "gemini-3.8-flash"
  )
  assert.equal(
    normalizeModelName("gemini", "models/gemini-1.5-pro"),
    "gemini-1.5-pro"
  )
  assert.equal(normalizeModelName("gemini"), "gemini-3.8-flash")
})

test("getCandidateModels builds prioritized deduplicated queue", () => {
  const queue = getCandidateModels("gemini", "gemini-2.5-pro")
  assert.equal(queue[0], "gemini-2.5-pro")
  assert.ok(queue.includes("gemini-3.8-flash"))
  assert.ok(queue.includes("gemini-1.5-flash"))
  assert.equal(new Set(queue).size, queue.length)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/llm-catalog.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/server/llm/types.ts` and `src/server/llm/catalog.ts`**

Define types matching Section 4.2 of the spec.
Implement `normalizeModelName` with alias rewriting (`gemini-2.5-flash` and `gemini-2.0-flash` -> `gemini-3.8-flash`, strip `models/` prefix).
Implement `getCandidateModels` with default tiers (`gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/llm-catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/llm/types.ts src/server/llm/catalog.ts tests/llm-catalog.test.ts
git commit -m "feat(llm): add core types and model catalog with alias normalization"
```

---

### Task 2: Provider Adapters (Gemini & vLLM / OpenAI-Compatible)

**Files:**

- Create: `src/server/llm/providers/gemini-provider.ts`
- Create: `src/server/llm/providers/openai-compatible.ts`
- Test: `tests/llm-providers.test.ts`

**Interfaces:**

- Consumes: `src/server/llm/types.ts`, `src/server/llm/catalog.ts`
- Produces:
  - `export async function callGeminiApi(options: ProviderCallArgs): Promise<ProviderRawResponse>`
  - `export async function callOpenAiCompatibleApi(options: ProviderCallArgs): Promise<ProviderRawResponse>`
  - `export async function discoverOpenAiModels(baseUrl: string, apiKey?: string): Promise<string[]>`

- [ ] **Step 1: Write the failing tests for Gemini and OpenAI-compatible adapters**

Create `tests/llm-providers.test.ts`:

- Test Gemini payload formatting with `systemInstruction`, `contents`, and `generationConfig.responseMimeType: "application/json"`.
- Test OpenAI-compatible payload formatting with `messages`, `response_format: { type: "json_object" }`.
- Test `discoverOpenAiModels` caches `/v1/models` within 5-minute TTL.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/llm-providers.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `gemini-provider.ts` and `openai-compatible.ts`**

In `gemini-provider.ts`:

- Make POST request to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`.
- Pass `responseMimeType: "application/json"` when structured mode is requested.
- Handle HTTP status codes and error parsing.

In `openai-compatible.ts`:

- Make POST request to `${baseUrl}/chat/completions`.
- Pass `response_format: { type: "json_object" }` when structured mode is requested.
- Implement `discoverOpenAiModels` with in-memory timestamped cache (TTL 300,000ms).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/llm-providers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/llm/providers/ tests/llm-providers.test.ts
git commit -m "feat(llm): add Gemini and OpenAI-compatible provider adapters with caching"
```

---

### Task 3: Core LlmClient Engine with Dynamic Fallback & Structured Validation

**Files:**

- Create: `src/server/llm/client.ts`
- Create: `src/server/llm/index.ts`
- Test: `tests/llm-client.test.ts`

**Interfaces:**

- Consumes: `src/server/llm/types.ts`, `src/server/llm/catalog.ts`, `src/server/llm/providers/*`
- Produces:
  - `export class LlmClient { generateText(...); generateStructured<T>(...) }`
  - `export function getLlmClient(): LlmClient`

- [ ] **Step 1: Write the failing tests for LlmClient**

Create `tests/llm-client.test.ts`:

- Test `generateText`: succeeds on primary model.
- Test `generateStructured`: successfully strips markdown fences and validates against Zod schema.
- Test candidate queue fallback on HTTP 404, 503, 429.
- Test schema failure fallback: if model 1 returns invalid JSON or failing schema, model 2 in candidate queue is attempted and succeeds.
- Test fail-fast on HTTP 401/403.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/llm-client.test.ts`
Expected: FAIL (client not found)

- [ ] **Step 3: Implement `src/server/llm/client.ts` and `src/server/llm/index.ts`**

Implement candidate queue iteration loop:

1. Resolve API credentials via `getEffectiveApiKey` if not passed explicitly.
2. Build candidate queue via `getCandidateModels`.
3. Try each candidate:
   - On 401/403, throw immediately.
   - On 404/503/429/500, log attempt in `LlmExecutionTrace` and continue to next candidate.
   - On successful HTTP response:
     - If `generateStructured`, sanitize markdown fences (`replace(/^```json\s*/i, "").replace(/```$/, "").trim()`), parse JSON, and validate via `schema.parse()`.
     - If JSON parse or schema validation fails, log attempt as `status: "schema_error"` and continue to next candidate.
4. If all candidates fail, throw comprehensive error with attempt trace.
   Export `getLlmClient()` and public types in `src/server/llm/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/llm-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/llm/client.ts src/server/llm/index.ts tests/llm-client.test.ts
git commit -m "feat(llm): implement core LlmClient engine with multi-model fallback and structured validation"
```

---

### Task 4: Settings & API Keys Integration for vLLM

**Files:**

- Modify: `src/server/api-keys.ts`
- Modify: `src/features/settings/server/types.ts`
- Modify: `src/features/settings/server/actions/test-api-key.ts`
- Modify: `src/features/settings/server/queries/get-api-keys-status.ts`
- Modify: `src/features/settings/components/api-keys-section/api-key-card.tsx`
- Test: `tests/llm-settings-vllm.test.ts`

**Interfaces:**

- Consumes: `src/server/llm/index.ts`
- Produces:
  - `SupportedProvider = "gemini" | "vllm"`
  - `getEffectiveEndpoint(provider)` / `getEffectiveApiKey(provider)`
  - UI Card in Settings for vLLM with Base URL and optional token input.

- [ ] **Step 1: Write the failing tests for vLLM settings and testing**

Create `tests/llm-settings-vllm.test.ts`:

- Test `getEffectiveApiKey("vllm")` and `getEffectiveEndpoint("vllm")` returning env fallback `VLLM_BASE_URL` or saved key.
- Test `testUserApiKey("vllm", ...)` pings `/v1/models` and returns active status.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/llm-settings-vllm.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `src/server/api-keys.ts`, `settings`, and UI components**

- Add `"vllm"` to `SUPPORTED_PROVIDERS` in `api-keys.ts` and `settings/server/types.ts`.
- In `test-api-key.ts`: handle `"vllm"` provider by pinging `/v1/models` with abort timeout and measuring latency.
- In `api-key-card.tsx`: support base URL input and custom placeholder for vLLM endpoint (`http://localhost:8000/v1` or `http://vllm:8000/v1`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/llm-settings-vllm.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/api-keys.ts src/features/settings/ tests/llm-settings-vllm.test.ts
git commit -m "feat(settings): add vLLM endpoint configuration and connection testing"
```

---

### Task 5: Refactor Tabular Mapping Synthesis to Unified Engine

**Files:**

- Modify: `src/features/tabular/server/actions/synthesize-mappings.ts`
- Test: `tests/tabular-mapping-prompt.test.ts`
- Test: `tests/tabular-mapping-synthesize.test.ts`

**Interfaces:**

- Consumes: `getLlmClient()` from `src/server/llm`
- Produces: `synthesizeOntologyMappingsAction` with zero direct HTTP fetches and automatic Gemini candidate fallback.

- [ ] **Step 1: Write tests verifying synthesizeOntologyMappingsAction uses LlmClient and survives 404**

Create/update `tests/tabular-mapping-synthesize.test.ts`:

- Verify `synthesizeOntologyMappingsAction` succeeds when primary model returns 404 and fallback model succeeds.
- Verify returned `mappingSpec` conforms to `DatasetMappingSpec` and PII sanitization applies.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/tabular-mapping-synthesize.test.ts`
Expected: FAIL (currently hardcoded to `gemini-2.5-flash` with direct fetch)

- [ ] **Step 3: Refactor `synthesizeOntologyMappingsAction`**

Replace lines 170-224 of `src/features/tabular/server/actions/synthesize-mappings.ts`:

- Call `getLlmClient().generateStructured({ prompt: { systemPrompt: prompt.systemPrompt, userPrompt: prompt.userPrompt }, schema: ... })`.
- Pass sanitized columns and masked rows as before.
- Apply `sanitizeSynthesizedElements(result.data)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/tabular-mapping-synthesize.test.ts tests/tabular-mapping-prompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/server/actions/synthesize-mappings.ts tests/tabular-mapping-synthesize.test.ts
git commit -m "fix(tabular): refactor schema synthesis to unified LlmClient with auto-fallback"
```

---

### Task 6: Refactor Ontology Features & Modernize UI

**Files:**

- Modify: `src/features/ontology/server/services/ai-ontology-generator/gemini-provider.ts`
- Modify: `src/features/ontology/server/services/ai-ontology-generator/ollama-provider.ts`
- Modify: `src/features/ontology/server/services/ai-relation-reconciliation.ts`
- Modify: `src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx`
- Test: `tests/ai-ontology-generation-llm.test.ts`
- Test: `tests/ai-relation-reconciliation.test.ts`

**Interfaces:**

- Consumes: `getLlmClient()` from `src/server/llm`
- Produces:
  - Cleaned `gemini-provider.ts` delegating to `LlmClient`
  - Cleaned `ollama-provider.ts` routing to `provider: "vllm"`
  - Cleaned `ai-relation-reconciliation.ts` delegating to `LlmClient`
  - Updated dialog UI tab labeled "Local vLLM (OpenAI API)"

- [ ] **Step 1: Write/update tests for ontology generation and relation reconciliation**

Update `tests/ai-relation-reconciliation.test.ts`:

- Verify `suggestRelationRemappings` delegates to `LlmClient` and preserves provenance tracking.
  Create `tests/ai-ontology-generation-llm.test.ts`:
- Verify `requestGeminiDraft` and `requestOllamaDraft` produce valid drafts through `LlmClient`.

- [ ] **Step 2: Run test to verify it fails or runs old code**

Run: `npm exec pnpm -- tsx --test tests/ai-relation-reconciliation.test.ts`

- [ ] **Step 3: Refactor ontology services and update UI dialog tab**

- In `gemini-provider.ts`: replace bespoke fetch loop with `getLlmClient().generateStructured({ prompt, schema: GeneratedOntologyDraftSchema, provider: "gemini" })`.
- In `ollama-provider.ts`: replace with `getLlmClient().generateStructured({ prompt, schema: GeneratedOntologyDraftSchema, provider: "vllm", baseUrl })`.
- In `ai-relation-reconciliation.ts`: replace duplicate loop with `getLlmClient().generateStructured({ prompt, schema: ..., provider: "gemini" })`.
- In `ai-generate-config-step.tsx`: update tab label from "Local Ollama" to "Local vLLM (OpenAI API)" and default port placeholder to `8000`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/ai-ontology-generation-llm.test.ts tests/ai-relation-reconciliation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/ tests/ai-ontology-generation-llm.test.ts
git commit -m "refactor(ontology): delegate generation and reconciliation to unified LlmClient and update vLLM UI"
```

---

### Task 7: Full Stack Verification & Docker Stack Rebuild

**Files:**

- Modify: `deploy/compose.yaml` (ensure any needed vLLM network/env configs are documented)
- Verify: All tests, typecheck, and lint

- [ ] **Step 1: Run comprehensive test suite**

Run: `npm exec pnpm -- test`
Expected: PASS (all tests pass, 0 failures)

- [ ] **Step 2: Run typecheck and lint**

Run: `npm exec pnpm -- typecheck`
Run: `npm exec pnpm -- lint`
Expected: PASS (0 errors, 0 warnings)

- [ ] **Step 3: Restart app container and verify live endpoints**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml restart app`
Verify: `curl.exe -I http://localhost:3010/ontology` returns 200 OK.

- [ ] **Step 4: Commit and finalize**

```bash
git commit --allow-empty -m "chore(llm): verify full test suite and rebuild stack"
```
