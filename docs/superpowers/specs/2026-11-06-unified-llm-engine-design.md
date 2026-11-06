# Design Spec: Unified TypeScript LLM Engine

**Status**: Approved & Ready for Planning  
**Date**: 2026-11-06  
**Author**: Antigravity

---

## 1. Intent and Why

Knowledge Graph Workbench features rely on Large Language Models for automated ontology drafting, competency question mapping, relation reconciliation, and tabular dataset schema induction.

Currently, each feature writes ad-hoc, brittle HTTP fetch calls with hardcoded model strings (e.g., `models/gemini-2.5-flash` in Tabular mapping synthesis). When upstream providers deprecate or rotate models—such as Google retiring `gemini-2.5-flash` for new users in favor of `gemini-3.8-flash` with HTTP 404 responses—features break individually across the application without fallback or recovery. Furthermore, local model invocation has been tied to Ollama's proprietary `/api/chat` instead of standard OpenAI-compatible endpoints like vLLM.

This design introduces a centralized, modular, and standardized LLM engine under `src/server/llm/`. It decouples domain actions from provider-specific protocols, provides automatic multi-model fallback (e.g. recovering seamlessly from 404, 503, 429), standardizes structured JSON generation, and supports both Google Gemini and OpenAI-compatible endpoints (specifically vLLM).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Single Source of Truth**: Centralize all LLM API invocations, key retrieval, prompt execution, and model catalog definitions inside `src/server/llm/`.
- **Dynamic Model Fallback & Self-Healing**: Automatically detect model unavailability (`404 Not Found`, `503 Overloaded`, `429 Rate Limited`) and schema failure, seamlessly rotating through a prioritized candidate queue (`gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, etc.).
- **Modern Google Gemini Compatibility**: Support active Google models (`gemini-3.8-flash`, `gemini-2.5-pro`), mapping legacy identifiers (`gemini-2.5-flash`, `gemini-2.0-flash`) gracefully.
- **OpenAI-Compatible & vLLM Support**: Standardize local/open-source inference via `OpenAiCompatibleProvider` targeting vLLM standard `/v1` endpoints (`/v1/chat/completions`, `/v1/models`).
- **Settings UI for vLLM & Gemini**: Provide browser-configurable endpoint and token inputs in **Settings > API Keys / Endpoints** with live connectivity testing (`testUserApiKey`).
- **Standardized Structured Extraction**: Provide a typed `generateStructured<T>()` API supporting Zod schemas or JSON Schema with automatic Markdown fence stripping, schema validation, and candidate queue fallback.
- **UI Modernization**: Update the Ontology AI Generation modal tab from "Local Ollama" to "Local vLLM (OpenAI API)".
- **Unified Feature Refactoring**: Migrate `synthesizeOntologyMappingsAction`, `requestGeminiDraft`, `suggestRelationRemappings`, and API key validation to the unified client.

### Non-Goals

- Replacing the Python `internal-extractor`'s internal use of `neo4j-graphrag` (the Python worker connects directly to vLLM/OpenAI via its standard client).
- Implementing client-side browser LLM calls (all calls remain Server Actions / Server Components for security and credential isolation).
- Cross-provider fallback (fallback is intra-provider: selecting Gemini cycles Gemini candidates; selecting vLLM targets the configured vLLM instance).

### Anti-Goals

- Never leak raw API keys, sensitive tokens, or unmasked PII into logs or error messages.
- Never fail an entire user workflow on a single model 404, 503, or malformed schema when candidate models are available.

---

## 3. Approaches Considered

### Approach 1: Core Modular TypeScript LLM Engine in `src/server/llm/` (Selected)

- **Description**: Build a clean internal service in `src/server/llm/` with a provider abstraction (`GeminiProvider`, `OpenAiCompatibleProvider`), a centralized fallback engine, and typed output validation.
- **Pros**:
  - Direct zero-latency execution in Next.js Server Actions without extra docker containers.
  - Native TypeScript types and Zod schema integration.
  - Consolidates duplicated fallback loops from `gemini-provider.ts` and `ai-relation-reconciliation.ts`.
- **Cons**: Requires refactoring existing feature callers to import from `@/server/llm`.

### Approach 2: Standalone LLM Gateway Sidecar (e.g. LiteLLM Container)

- **Description**: Run a third-party proxy container in Docker that Next.js and Python connect to via HTTP.
- **Pros**: Single endpoint for all languages.
- **Cons**: Adds another process/container, increases deployment complexity, adds network overhead, and complicates dynamic per-user API key resolution.

**Decision**: Approach 1 was selected for simplicity, performance, type safety, and direct compatibility with Workbench's existing user API key encryption and session management.

---

## 4. Architectural & Component Design

### 4.1 Folder Structure

```
src/server/llm/
├── index.ts                  # Public exports: getLlmClient, types, catalog
├── types.ts                  # Provider interfaces, request/response types
├── catalog.ts                # Model catalog, defaults, and fallback queues
├── client.ts                 # Main LlmClient implementation with fallback engine
└── providers/
    ├── gemini-provider.ts    # Google Gemini REST implementation
    └── openai-compatible.ts  # vLLM / OpenAI REST implementation (/v1)
```

### 4.2 Interfaces and Types (`src/server/llm/types.ts`)

```typescript
export type SupportedLlmProvider = "gemini" | "vllm" | "openai"

export interface LlmModelMetadata {
  id: string
  name: string
  provider: SupportedLlmProvider
  contextWindow?: number
  supportsStructured: boolean
  isDefault?: boolean
}

export interface LlmPrompt {
  systemPrompt?: string
  userPrompt: string
}

export interface LlmGenerateOptions {
  provider?: SupportedLlmProvider
  model?: string
  candidateModels?: string[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  apiKey?: string
  baseUrl?: string // For vLLM / OpenAI-compatible endpoints
}

export interface LlmStructuredOptions<T> extends LlmGenerateOptions {
  schema: import("zod").ZodType<T> | Record<string, unknown>
  schemaName?: string
  schemaDescription?: string
}

export interface LlmExecutionTrace {
  provider: SupportedLlmProvider
  model: string
  attempts: Array<{
    model: string
    status: number | "schema_error" | "error"
    error?: string
    durationMs: number
  }>
  totalDurationMs: number
}

export interface LlmTextResult {
  text: string
  trace: LlmExecutionTrace
}

export interface LlmStructuredResult<T> {
  data: T
  rawText: string
  trace: LlmExecutionTrace
}
```

### 4.3 Central Model Catalog & Fallbacks (`src/server/llm/catalog.ts`)

- **Default Gemini Models**:
  1. `gemini-3.8-flash` (Primary default for fast structured inference)
  2. `gemini-2.5-pro` (High-reasoning fallback)
  3. `gemini-1.5-flash` (Legacy fallback)
  4. `gemini-1.5-pro` (Legacy high-reasoning fallback)
- **Model Normalization**:
  - Automatically transforms deprecated/retired model names:
    - `gemini-2.5-flash` -> `gemini-3.8-flash`
    - `gemini-2.0-flash` -> `gemini-3.8-flash`
    - Strips leading `models/` prefix.
- **vLLM / Local Default**:
  - Endpoint resolved via:
    1. User setting stored in database (Settings UI)
    2. Environment variable `VLLM_BASE_URL` (default: `http://vllm:8000/v1` or `http://localhost:8000/v1`)
  - Model auto-discovery queries `/v1/models` and caches the result for 5 minutes. If no model is explicitly requested, the first active model from vLLM is automatically used.

### 4.4 Engine Behavior & Fallback Execution (`src/server/llm/client.ts`)

1. **Intra-Provider Candidate Queue**:
   - For `provider: "gemini"`: Queue is `[requestedModel, ...candidateFallbacks]` (defaulting to the 4-tier Gemini queue).
   - For `provider: "vllm"`: Queue targets the configured vLLM endpoint, resolving the active served model via cached `/v1/models`.
2. **Schema Enforcement & Retry Strategy**:
   - Provider adapters pass native JSON mode flags:
     - Gemini: `responseMimeType: "application/json"` (and OpenAPI schema if JSON Schema object provided).
     - vLLM / OpenAI: `response_format: { type: "json_object" }`.
   - Downstream, the engine sanitizes Markdown code fences (e.g. `json ... `) and validates output against the provided Zod schema.
   - If JSON parsing or Zod schema validation fails, the attempt is logged as `status: "schema_error"` and the engine automatically falls back to the next candidate model in the queue.
3. **HTTP Error Handling**:
   - `404 Not Found` (model retired), `503 Unavailable` (overloaded), `429 Too Many Requests` (quota spike), or `500`: Log attempt and advance immediately to the next candidate model.
   - `401 Unauthorized` / `403 Forbidden` (invalid API key): Fail fast immediately without burning redundant retries.

---

## 5. Settings & UI Modernization

### 5.1 Settings: API Keys & Endpoints UI

- Add support for provider `"vllm"` in `src/server/api-keys.ts` and `src/features/settings/`:
  - Store endpoint URL and optional bearer token in `user_api_keys` (or encrypted settings).
  - Add a dedicated **vLLM / Local Endpoint** card in **Settings > API Keys** with:
    - Base URL input (e.g. `http://vllm:8000/v1`)
    - Optional API Key input
    - "Test Connection" button testing `/v1/models` and reporting latency and discovered models.

### 5.2 Ontology AI Generation Modal

- In [`ai-generate-config-step.tsx`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/src/features/ontology/components/ontology-details-dialog/competency-questions-tab/ai-generate-dialog/ai-generate-config-step.tsx):
  - Rename tab from **"Local Ollama"** to **"Local vLLM (OpenAI API)"**.
  - Default URL to `http://localhost:8000/v1` (or user's saved vLLM endpoint).
  - Forward generation requests to `src/server/llm/` using `provider: "vllm"`.

---

## 6. Refactoring Plan for Existing Features

1. **Tabular Feature (`src/features/tabular/server/actions/synthesize-mappings.ts`)**:
   - Remove raw inline `fetch("...models/gemini-2.5-flash...")`.
   - Delegate to `getLlmClient().generateStructured({ prompt, schema: DatasetMappingSpecSchema, provider: "gemini" })`.
   - _Result_: Immediately eliminates the 404 error and inherits resilient multi-model fallback.

2. **Ontology Generation (`src/features/ontology/server/services/ai-ontology-generator/`)**:
   - In `gemini-provider.ts`, replace custom fetch and duplicate fallback loop with `getLlmClient().generateStructured(...)`.
   - In `ollama-provider.ts`, update to use `getLlmClient().generateStructured({ ..., provider: "vllm" })`.

3. **Relation Reconciliation (`src/features/ontology/server/services/ai-relation-reconciliation.ts`)**:
   - Replace duplicate model queue and loop with `getLlmClient().generateStructured(...)`.

4. **Settings Key Testing (`src/features/settings/server/actions/test-api-key.ts`)**:
   - Test Gemini and vLLM providers using the standardized client and model catalog.

---

## 7. Testing & Verification

- **Unit Tests (`tests/llm-client.test.ts`, `tests/llm-catalog.test.ts`)**:
  - Model catalog alias normalization (`gemini-2.5-flash` -> `gemini-3.8-flash`).
  - Fallback engine: Simulates 404 and 503 HTTP responses and verifies transition to candidate fallback model.
  - Fail-fast on 401/403 (invalid key).
  - Schema validation failure: Verifies fallback to next candidate model on malformed JSON or Zod schema violation.
  - vLLM model discovery caching (5-minute TTL).
- **Integration Tests**:
  - `tests/tabular-mapping-prompt.test.ts`: Verify Tabular mapping synthesis succeeds against mocked / live Gemini client.
  - `tests/ai-relation-reconciliation.test.ts`: Verify relation reconciliation uses new engine.
- **Regression Check**:
  - `pnpm test`, `pnpm typecheck`, `pnpm lint`, and rebuild Docker stack.
