# Ontology Assistant & MCP Server Design

**Date:** 2026-11-16  
**Scope:** Project (Right-hand Ontology Assistant UI on `/ontology` + In-App Preview/Apply Agent + Shared Ontology Tool Engine + Streamable HTTP `/api/mcp` Server)  
**Target Branch:** `main`

---

## 1. Intent & Why

Users authoring ontologies in `kg-workbench` currently edit classes, attributes, relations, modules, and competency questions (CQs) through manual forms and dialogs. Meanwhile, external AI coding assistants such as **Antigravity** have no structured way to inspect or modify ontologies stored in PostgreSQL's canonical LinkML document store.

This project adds two connected ways of working against the same ontology domain layer:

1. **In-App Ontology Assistant (`/ontology` only):** A right-hand chat panel where users can ask questions about the active ontology, draft and attach CQs, and edit the schema in natural language—always previewing proposed edits and blast-radius impact before applying them.
2. **External MCP Server (`/api/mcp`):** A Model Context Protocol server exposing structured, deterministic tools (`list_ontologies`, `create_class`, `add_cq`, `rename_symbol`, `check_blast_radius`, `export_ontology`, etc.) so Antigravity can inspect, validate, and edit `kg-workbench` ontologies directly.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

- **Ontology-page scoped UI:** Render the Ontology Assistant only on `/ontology`, integrated cleanly into the existing right-hand `DetailPanelShell` without disrupting `/analyst`, `/documents`, `/settings`, or squeezing the graph canvas.
- **Always preview first (in-app):** Every in-app edit request generates a structured **Proposed Changes** card showing each operation and any blast-radius impact on facts, CQs, or extractions. Nothing writes to PostgreSQL until the user clicks **Apply**.
- **User-configured LLM backing:** The in-app agent uses `LlmClient` (`src/server/llm/client.ts`) with the user's configured Gemini, OpenAI-compatible, or local vLLM/Ollama keys and endpoints from Settings.
- **Single shared tool engine:** Both the in-app agent and the MCP server invoke the same typed, Zod-validated **Ontology Tool Engine** built on top of `src/features/ontology/server/` (canonical LinkML store, symbol cascades, CQs, blast radius, linter, reasoner, and `ohi.dev`).
- **Docker-ready MCP for Antigravity:** Host a stateless Streamable HTTP MCP endpoint at `/api/mcp` inside the Next.js app container (default `http://localhost:3010/api/mcp`) plus an optional `stdio` CLI entrypoint sharing the same tool registry.
- **Live UI sync:** Edits applied by Antigravity via MCP surface cleanly in an open `/ontology` tab (on window focus and lightweight background refresh).

### Non-Goals

- Replacing or merging with the `/analyst` Graph Analyst workbench (which answers cross-document/table queries and resolves contradictions).
- Streaming Antigravity IDE prompts _out_ from the browser UI (Antigravity connects _in_ via MCP).
- Modifying the Phase 4/5 UI deliverables in `docs/plans/15-ohi-linkml-architecture/` (Compiler Studio, Standards Browser, PROV-O bundle export).

### Anti-Goals

- **Silent destructive edits:** Renaming or deleting classes/relations/attributes in the in-app chat must never bypass the preview + blast-radius check.
- **Raw SQL or parallel LinkML writers:** Neither the chat agent nor MCP tools may bypass the canonical LinkML AST / `cascadeSymbolRename` / `cascadeSymbolDelete` services—doing so would desync `linkml_yaml`, `compiled_artifacts`, CQs, and extraction facts.
- **Duplicated tool logic:** In-app tool execution and MCP tool execution must not maintain two separate implementations of schema mutations.

---

## 3. Constraints & Codebase Grounding

- **Canonical Store:** `ontology_documents.linkml_yaml` + `ui_layout` + `compiled_artifacts` (`src/server/db/schema.ts`), mutated through `src/features/ontology/server/linkml/` and `src/features/ontology/server/actions/*`.
- **Competency Questions:** `ontology_competency_questions`, `ontology_competency_question_modules`, and `ontology_cq_triples`, using `text` symbol keys referencing LinkML class/relation IDs.
- **Multi-tenancy & Auth Bypass:** Server actions and queries normally scope via `getCurrentGroupKeyOrThrow()` (cookies). To support cookie-less MCP calls even when `APP_PASSWORD_PROTECTION_ENABLED=true`, `src/proxy.ts` must allow `/api/mcp` through without a session cookie, and ontology queries/mutations/blast-radius helpers used by the Ontology Tool Engine must accept an explicit `groupKey` context parameter. `/api/mcp` authenticates via `Authorization: Bearer <KG_MCP_TOKEN>` and resolves `groupKey` from `x-kg-group-key` (falling back to `KG_MCP_GROUP_KEY` or `"shared"`).
- **Existing Layout:** `OntologyShell` (`src/features/ontology/components/ontology-shell/ontology-shell.tsx`) already renders `DetailPanelShell` on the right side of `/ontology`.
- **No `updated_at` on `ontology_documents`:** Live sync checks can use a lightweight fingerprint endpoint (e.g., hash of `linkml_yaml` + `ui_layout` + CQ count/max `created_at`) or `router.refresh()` on focus/interval.
- **Repository Contract (`AGENT_CONTRACT.md`):** Keep `"use client"` strictly in interactive UI components, avoid `any`, keep React Flow isolated, use `src/lib/routes.ts`, use TanStack Query for client server-state/mutations, and maintain `src/features/ontology/README.md`.

---

## 4. Approaches Considered

### Approach 1: Shared Tool Engine + Streamable HTTP `/api/mcp` inside Next.js _(Chosen)_

- A single Zod-typed **Ontology Tool Engine** (`src/features/ontology/server/assistant-tools/`) wraps existing ontology/CQ/LinkML/reasoner/ohi services.
- In-app chat calls `/api/ontology/assistant` (server route using `LlmClient`), running read tools as needed and returning either a text answer or a `ProposedChangePlan` for **Apply / Discard**.
- `/api/mcp` exposes the exact same tool registry via `@modelcontextprotocol/sdk` Streamable HTTP transport (`WebStandardStreamableHTTPServerTransport`), protected by `KG_MCP_TOKEN` (with safe local default or env-configured bearer auth). An optional `pnpm mcp` stdio script reuses the same registry.
- **Why chosen:** Works directly against the running Dockerized `app` container (`http://localhost:3010/api/mcp`) with zero host-side DB credentials or `server-only` bundler flags, while guaranteeing one source of truth for both the UI chat and Antigravity.

### Approach 2: Standalone `stdio` MCP CLI Only

- Antigravity spawns a local `tsx --conditions=react-server` process connecting directly to Postgres on port 5433, separate from Next.js.
- **Why rejected as primary:** Requires local Node + `--conditions=react-server` + host DB credentials in `mcp_config.json`, breaks when running only via Docker on another host, and duplicates transport/runtime plumbing. (Keeping a thin `stdio` wrapper over Approach 1's shared registry is trivial if ever needed.)

### Approach 3: Separate Python MCP Service

- **Why rejected:** All LinkML AST parsing, `@neverblink/linkml` compilation, `ohi.dev` dependency resolution, and CQ triple logic live in TypeScript. Rebuilding them in Python would duplicate the core domain.

---

## 5. Architecture & Component Design

### 5.1 Shared Ontology Tool Engine (`src/features/ontology/server/assistant-tools/`)

Each tool is defined once with `{ name, description, mode: "read" | "write", inputSchema (Zod), execute(ctx, input) }` where `ctx` supplies `{ groupKey, db? }`:

1. **Discover & Inspect (`read`)**
   - `list_ontologies` — list ontology documents (`id`, `name`, `version`, `defaultLanguage`, `usecase`).
   - `get_ontology_summary` — modules, class list, relation list, CQ count, linter defect count.
   - `get_class_details` — full class metadata, attributes, incoming/outgoing relations, notes, examples, and linked CQs.
   - `search_symbols` — fuzzy/substring search across classes, attributes, relations, and modules.
   - `get_linkml_yaml` — return raw `linkml_yaml` (and optional `ohi_yaml`).
   - `list_cqs` — list CQs with status, assigned modules, and linked SPO triples.
   - `get_reasoner_report` — fetch latest reasoner run status, violations, and entailments.

2. **Safety & Validation (`read` / `trigger`)**
   - `check_blast_radius` — inspect downstream impact on `facts`, `document_entities`, `entity_attribute_values`, and `ontology_cq_triples` before renaming/deleting symbols (`write`-preview helper).
   - `lint_ontology` — run LinkML + workbench linter and return structured defects.
   - `run_reasoner` — _(Builder call)_ enqueue an async reasoner job via `requestOntologyReasoningAction` / `fastPathAwaitJob` and return `{ status: "completed" | "pending" | "offline", jobId, result? }` immediately if `pending` (callers poll `get_reasoner_report`).

3. **Competency Questions (`write` / `read`)**
   - `list_cqs` (`read`) — list CQs with derived `status` (`"covered"` if at least one SPO triple is linked, `"uncovered"` otherwise; _builder call — avoids DB migration_), assigned modules, and linked SPO triples.
   - `add_cq` — create a new CQ (text, module assignment, optional initial SPO triple).
   - `update_cq` — edit CQ text or module links.
   - `delete_cq` — delete a CQ.
   - `link_cq_triple` — attach or update subject class, predicate relation, and object class on a CQ.

4. **Ontology Edits (`write`)**
   - `create_class` / `update_class` / `delete_class`
   - `rename_symbol` — transactional symbol rename across LinkML AST, CQs, and fact references via `cascadeSymbolRename`.
   - `upsert_attribute` / `delete_attribute`
   - `create_relation` / `update_relation` / `delete_relation`
   - `create_module`
   - `apply_linkml_patch` — _(Builder call)_ accepts a full validated replacement `linkml_yaml` document (parsed and validated by `@neverblink/linkml`), diffs AST (`diffLinkmlAstSymbols`), runs cascades if symbols are removed/renamed, and saves `linkml_yaml`.

5. **Standards & Export (`read` / `write`)**
   - `search_ohi_packages` (`read`) — search `ohi.dev` catalog (with `builtin-publications.ts` fallback if offline).
   - `add_ohi_dependency` (`write`) — _(Builder call)_ delegates to `addReferenceOntology` + lockfile verification (falling back to `builtin-publications.ts` if `ohi.dev` is unreachable in Docker).
   - `export_ontology` (`read`) — compile/export `linkml-yaml`, `shacl`, `owl`, `rdfs`, `json-schema`, or `pydantic`.

**Preview Support:** Every `write` tool has a deterministic `describeOperation(ctx, input)` helper that produces a human-readable summary line (e.g., `+ Class: Voyage`, `~ Rename: Vessel -> Ship (3 facts, 2 CQs affected)`) and automatically runs `check_blast_radius` for renames/deletes.

---

### 5.2 Right-Hand Ontology Assistant UI (`/ontology` only)

- **Host:** `DetailPanelShell` (`src/features/ontology/components/ontology-shell/detail-panel-shell.tsx`) gains a compact segmented toggle in its header: **`Details` | `Assistant`**.
- **Header Trigger:** `OntologyHeader` gets an **Assistant** button/icon that expands `DetailPanelShell` (if collapsed in visual mode) and switches it to the `Assistant` tab.
- **Scoped strictly to `/ontology`:** Mounted only inside `OntologyShell`; no sidebar or global layout changes.
- **Chat Components (`src/features/ontology/components/ontology-assistant/`):**
  - `ontology-assistant-panel.tsx` — manages conversation state (per `ontologyId` in session/client state with "Clear chat"), provider/model selector (reusing Settings providers), and API calls.
  - `assistant-message-item.tsx` — renders user prompts, assistant markdown replies, read-tool inspection badges (collapsible "Inspected 3 tools"), and **Proposed Changes** preview cards.
  - `proposed-changes-card.tsx` — lists each staged operation (`create`, `update`, `rename`, `delete`, `cq`) with a type badge, summary, optional blast-radius warning banner, and **`Apply Changes`** / **`Discard`** buttons. Once applied, turns into a read-only `"Applied (N changes)"` receipt and calls `router.refresh()` + invalidates CQ/ontology queries.
  - `assistant-input-bar.tsx` — textarea with Enter-to-send, quick starter chips (e.g. _"Suggest CQs for missing coverage"_, _"Lint & fix schema gaps"_, _"Add a class and relations"_), and loading state.

---

### 5.3 In-App Agent Endpoint (`/api/ontology/assistant`)

- **Request:** `{ ontologyId, messages: Array<{ role, content }>, provider?, model? }`
- **Execution Flow:**
  1. Verify access & load active ontology summary + `groupKey`.
  2. Call `LlmClient` with a structured JSON contract / bounded multi-step loop (max 4 read-tool iterations so the model can call `get_class_details`, `list_cqs`, `lint_ontology`, etc. to ground its response before answering).
  3. The model outputs:
     - `reply`: concise natural-language explanation.
     - `proposedOperations`: `Array<{ tool: WriteToolName, args: Record<string, unknown> }>` (empty for pure Q&A).
  4. The server validates every proposed operation against its Zod `inputSchema`, runs `describeOperation` + `check_blast_radius` for each, and returns `{ reply, inspectedTools, proposal: { id, operations, hasDestructiveChanges, validationErrors } }`.
- **Apply Endpoint (`POST /api/ontology/assistant/apply` or server action `applyAssistantProposalAction`):**
  - Re-validates the approved `operations` list with Zod and executes all operations inside a **single PostgreSQL transaction** (`db.transaction(async (tx) => ...)`), passing `tx` and `groupKey` through LinkML, CQ, and OHI mutations.
  - **Atomic rollback & feedback:** If any operation fails, the entire transaction rolls back cleanly with zero partial writes, and the endpoint returns the exact failing step index, tool name, and error message so the **Proposed Changes** card displays an inline error banner and keeps the proposal intact for retry or discard.
  - On success, triggers `revalidatePath` and returns per-operation results + refreshed summary.

---

### 5.4 Streamable HTTP MCP Server (`/api/mcp`)

- **Dependency:** `@modelcontextprotocol/sdk` (`McpServer` + `WebStandardStreamableHTTPServerTransport`).
- **Route:** `src/app/api/mcp/route.ts` handling `POST`, `GET`, and `DELETE` per MCP Streamable HTTP spec (stateless per-request transport so it works cleanly in Next.js App Router / standalone Docker builds).
- **Proxy & Authentication:**
  - `src/proxy.ts` explicitly exempts `/api/mcp` from browser cookie/password redirects (`/access`).
  - Configured via `KG_MCP_TOKEN` environment variable (and documented for `deploy/.env.server`).
  - Every `/api/mcp` request must present `Authorization: Bearer <KG_MCP_TOKEN>` (if `KG_MCP_TOKEN` is unset, fail closed with `401 Unauthorized` unless explicitly in local loopback dev).
  - Resolves `groupKey` from `x-kg-group-key` header (defaulting to `KG_MCP_GROUP_KEY` or `"shared"`), passing it into `ctx` instead of reading cookies.
- **Tool Registration:** Iterates over the shared Ontology Tool Engine registry and registers every read and write tool on `McpServer` with its Zod schema and structured JSON text response.
- **Documentation & Config:** Include a ready-to-paste Antigravity `mcp_config.json` snippet in `src/features/ontology/README.md` / Settings or docs pointing to `http://localhost:3010/api/mcp`.

---

### 5.5 Live UI Sync for External MCP Edits

- Add a lightweight `GET /api/ontology/[id]/fingerprint` endpoint (or query) returning a fast hash of `(linkml_yaml, ui_layout, cq_count, latest_cq_timestamp)` for the active ontology.
- `OntologyShell` checks this fingerprint on window focus and on a conservative interval (e.g., every 10s when the tab is visible). When the fingerprint changes externally (e.g., Antigravity edited via MCP), it triggers `router.refresh()` and shows a subtle toast (`"Ontology updated externally"`).

---

## 6. What's Left to the Builder

- Exact Tailwind styling, icons, and keyboard shortcuts matching existing `DetailPanelShell` and `chat-view` conventions.
- Exact system prompt wording for the in-app `LlmClient` planner and tool descriptions for MCP.
- Choosing whether `proposedOperations` uses strict JSON schema output (`LlmClient.generateStructured`) with an explicit `done` / `call_read_tool` envelope so it works uniformly across Gemini, OpenAI, and local Ollama/vLLM models without relying on provider-specific function-calling quirks.
- Deciding the exact `KG_MCP_TOKEN` default/setup in `deploy/.env.server` and `deploy/compose.yaml`.
