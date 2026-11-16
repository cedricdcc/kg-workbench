# Ontology Assistant & MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a right-hand Ontology Assistant chat panel (scoped to `/ontology` with preview-before-apply edits) and a Streamable HTTP MCP server (`/api/mcp`) backed by one shared, typed Ontology Tool Engine on top of the canonical LinkML store.

**Architecture:** All ontology read/write/CQ/validation/export operations live in a shared Zod-typed **Ontology Tool Engine** (`src/features/ontology/server/assistant-tools/`). The in-app chat route (`/api/ontology/assistant`) uses `LlmClient` in a bounded read-tool loop to generate a `ProposedChangePlan` (never mutating directly), which executes atomically inside a single Postgres transaction when the user clicks **Apply**; meanwhile `/api/mcp` exposes the exact same tool registry to Antigravity via `@modelcontextprotocol/sdk` Streamable HTTP with bearer auth and `AsyncLocalStorage` group-key scoping.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod `^4.6.5`, `@modelcontextprotocol/sdk`, Drizzle ORM + PostgreSQL, `@neverblink/linkml`, `LlmClient`, TanStack Query, shadcn/ui, `tsx --conditions=react-server --test`.

**Spec:** [`docs/superpowers/specs/2026-11-16-ontology-assistant-and-mcp-design.md`](../specs/2026-11-16-ontology-assistant-and-mcp-design.md)

## Global Constraints

- Scope the assistant UI strictly to `/ontology` inside `DetailPanelShell` via a `Details | Assistant` toggle plus a header shortcut; never mount it on other routes.
- Always preview in-app edits first: `/api/ontology/assistant` never writes to PostgreSQL; `/api/ontology/assistant/apply` runs all approved operations inside one `db.transaction` and rolls back atomically on any failure, returning the failing step and error message.
- Never bypass canonical LinkML AST / `cascadeSymbolRename` / `cascadeSymbolDelete` services with raw SQL.
- Exempt `/api/mcp` from `src/proxy.ts` cookie redirects and require `Authorization: Bearer <KG_MCP_TOKEN>` (fail closed if unset in production; `x-kg-group-key` header defaults to `KG_MCP_GROUP_KEY` or `"shared"`).
- Derive CQ `status` as `"covered"` (at least 1 linked SPO triple) vs. `"uncovered"` with no DB migration.
- Follow `AGENT_CONTRACT.md`: `"use client"` only on interactive UI, avoid untyped `any`, use `pnpm` only, and update `src/features/ontology/README.md`.

## Review Focus

- **Cookie-less MCP access with `APP_PASSWORD_PROTECTION_ENABLED=true`:** Calling `/api/mcp` with a valid bearer token and no cookies must succeed without redirecting to `/access` or throwing `No valid app access group is active.` inside `assertOntologyDocumentAccess`.
- **Multi-step atomic rollback:** Submitting a 3-step `ProposedChangePlan` where step 3 fails (e.g., invalid relation target or missing symbol) must leave steps 1 and 2 rolled back in PostgreSQL and return `{ ok: false, failedStepIndex: 2, failedTool, error }`.
- **Outdated/stale proposal rejection or validation:** If an LLM proposes an invalid tool name or malformed args, `previewProposedOperations` must surface structured `validationErrors` without crashing the chat response.
- **Unauthenticated `/api/mcp` rejection:** A request to `/api/mcp` without `Authorization: Bearer <KG_MCP_TOKEN>` (or with a wrong token) must return `401` even when `APP_PASSWORD_PROTECTION_ENABLED=false`.
- **External MCP edit live sync:** When `/api/ontology/[id]/fingerprint` changes due to an external MCP edit, `OntologyShell` must refresh once without losing unsaved chat history in the assistant panel.

---

### File Structure

- **Install / Infra:** `package.json`, `src/proxy.ts`, `src/server/group-access.ts`, `src/features/ontology/server/linkml/document-store.ts`, `deploy/compose.yaml`
- **Shared Ontology Tool Engine:** `src/features/ontology/server/assistant-tools/{types.ts,read-tools.ts,write-tools.ts,executor.ts,registry.ts}`
- **MCP Server:** `src/server/mcp/{auth.ts,ontology-mcp-server.ts}`, `src/app/api/mcp/route.ts`
- **In-App Assistant Backend & Fingerprint:** `src/features/ontology/server/assistant/{agent.ts,fingerprint.ts}`, `src/app/api/ontology/assistant/route.ts`, `src/app/api/ontology/assistant/apply/route.ts`, `src/app/api/ontology/[id]/fingerprint/route.ts`
- **Right-Hand Assistant UI:** `src/features/ontology/components/ontology-assistant/{ontology-assistant-panel.tsx,assistant-message-item.tsx,proposed-changes-card.tsx,assistant-input-bar.tsx}`, `src/features/ontology/components/ontology-shell/{detail-panel-shell.tsx,ontology-shell.tsx}`, `src/features/ontology/components/ontology-header/ontology-header.tsx`, `src/features/ontology/README.md`

---

### Task 1: MCP Dependency, Proxy Bypass, Group-Key Context & Transaction Hook

**Files:**

- Modify: `package.json`
- Modify: `src/proxy.ts:21-30`
- Modify: `src/server/group-access.ts:59-78`
- Modify: `src/features/ontology/server/linkml/document-store.ts:30-45,125-180`
- Test: `tests/ontology-mcp-infra.test.ts`

**Interfaces:**

- Produces: `runWithGroupKey<T>(groupKey: string, fn: () => Promise<T>): Promise<T>` in `src/server/group-access.ts`
- Produces: `saveCanonicalOntology(ontologyId, mutator, options?: { db?: DbClient; tx?: DbTransaction; diffOptions?: ... })` in `src/features/ontology/server/linkml/document-store.ts`

- [ ] **Step 1: Install `@modelcontextprotocol/sdk`**
      Run: `cmd /c npm exec pnpm -- add @modelcontextprotocol/sdk`
      Expected: `@modelcontextprotocol/sdk` added to `package.json` and `pnpm-lock.yaml`.

- [ ] **Step 2: Write failing tests in `tests/ontology-mcp-infra.test.ts`**
      Test:
  1. `runWithGroupKey("marine-team", async () => getCurrentGroupKeyOrThrow())` returns `"marine-team"` even when `cookies()` is unavailable.
  2. `proxy(new NextRequest("http://localhost:3010/api/mcp", { method: "POST" }))` with `APP_PASSWORD_PROTECTION_ENABLED="true"` returns `NextResponse.next()` (status 200 pass-through, not a 307 redirect to `/access`).

- [ ] **Step 3: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-mcp-infra.test.ts`
      Expected: FAIL (`runWithGroupKey` not exported; `proxy` redirects `/api/mcp` to `/access`).

- [ ] **Step 4: Implement infra changes**
  - In `src/server/group-access.ts`: add `AsyncLocalStorage<string>()` (`groupKeyStorage`) and `runWithGroupKey(groupKey, fn)`. Update `getCurrentGroupOrThrow()` so if `groupKeyStorage.getStore()` is defined, it returns `{ key: storeKey, label: storeKey, password: "" } as AppAccessGroup` before reading `cookies()`.
  - In `src/proxy.ts`: add `pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")` to the early pass-through check.
  - In `src/features/ontology/server/linkml/document-store.ts`: add `tx?: DbTransaction` to `SaveCanonicalOntologyOptions`; when `options?.tx` is provided, call `executeInTx(options.tx)` directly instead of `database.transaction(executeInTx)`.

- [ ] **Step 5: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-mcp-infra.test.ts`
      Expected: PASS (2/2).
      Commit: `git add package.json pnpm-lock.yaml src/proxy.ts src/server/group-access.ts src/features/ontology/server/linkml/document-store.ts tests/ontology-mcp-infra.test.ts && git commit -m "feat(ontology): add MCP SDK, proxy bypass, group-key ALS, and tx hook"`

---

### Task 2: Shared Ontology Tool Engine — Types, Read & Validation Tools

**Files:**

- Create: `src/features/ontology/server/assistant-tools/types.ts`
- Create: `src/features/ontology/server/assistant-tools/read-tools.ts`
- Test: `tests/ontology-assistant-read-tools.test.ts`

**Interfaces:**

- Consumes: `getOntologyDocuments`, `getOntologyDocument`, `getOntologyClasses`, `getOntologyRelations`, `getOntologyModules`, `getOntologyCQs`, `loadCanonicalOntology`, `getClassBlastRadius`, `getRelationBlastRadius`, `runOntologyLinter`, `requestOntologyReasoningAction`, `getLatestReasonerRunQuery`, `searchOhiRegistryAction`, `exportOntologyToShacl`, `exportOntologyToOwl`, `compileLinkml`
- Produces:
  - `OntologyToolContext` (`{ groupKey: string; db?: DbClient; tx?: DbTransaction }`)
  - `OntologyToolDefinition<TInput, TOutput>` (`{ name, description, mode: "read" | "write", inputSchema, execute, describeOperation? }`)
  - `ProposedOperation` & `ProposedChangePlan` & `ApplyProposalResult`
  - `READ_TOOLS: Record<string, OntologyToolDefinition<any, any>>` (specifically typed at the tool level, using generic/unknown at registry boundary)

- [ ] **Step 1: Write failing tests in `tests/ontology-assistant-read-tools.test.ts`**
      Test:
  1. `READ_TOOLS` exposes all 12 read/validation tools: `list_ontologies`, `get_ontology_summary`, `get_class_details`, `search_symbols`, `get_linkml_yaml`, `list_cqs`, `get_reasoner_report`, `check_blast_radius`, `lint_ontology`, `run_reasoner`, `search_ohi_packages`, `export_ontology`.
  2. `list_cqs` maps linked triples to derived `status: "covered"` vs. `"uncovered"`.
  3. Zod `inputSchema.safeParse` rejects invalid `export_ontology` formats or missing `ontologyId`.

- [ ] **Step 2: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-read-tools.test.ts`
      Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `types.ts` and `read-tools.ts`**
  - Define Zod schemas and tool handlers delegating to existing query/linter/blast-radius/compiler/OHI services inside `runWithGroupKey(ctx.groupKey, ...)`.
  - Ensure `export_ontology` supports `"linkml-yaml" | "shacl" | "owl" | "rdfs" | "json-schema" | "pydantic"`.
  - Ensure `run_reasoner` delegates to `requestOntologyReasoningAction` and returns `{ status, jobId, result? }` without blocking beyond the fast-path wait.

- [ ] **Step 4: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-read-tools.test.ts`
      Expected: PASS.
      Commit: `git add src/features/ontology/server/assistant-tools/types.ts src/features/ontology/server/assistant-tools/read-tools.ts tests/ontology-assistant-read-tools.test.ts && git commit -m "feat(ontology): add shared assistant read and validation tools"`

---

### Task 3: Shared Ontology Tool Engine — Write Tools, Preview & Atomic Batch Executor

**Files:**

- Create: `src/features/ontology/server/assistant-tools/write-tools.ts`
- Create: `src/features/ontology/server/assistant-tools/executor.ts`
- Create: `src/features/ontology/server/assistant-tools/registry.ts`
- Modify: `src/features/ontology/server/actions/competency-questions.ts` (accept optional `tx?: DbTransaction` or expose `tx`-aware internal helpers)
- Test: `tests/ontology-assistant-write-executor.test.ts`

**Interfaces:**

- Consumes: `saveCanonicalOntology`, `loadCanonicalOntology`, `diffLinkmlSnapshots`, `createClass`, `updateClass`, `deleteClass`, `addAttribute`, `updateAttribute`, `deleteAttribute`, `createRelation`, `updateRelation`, `deleteRelation`, `createCQ`, `updateCQ`, `deleteCQ`, `updateCQTriples`, `createModule`, `addReferenceOntology`, `getClassBlastRadius`, `getRelationBlastRadius`
- Produces:
  - `WRITE_TOOLS` (`add_cq`, `update_cq`, `delete_cq`, `link_cq_triple`, `create_class`, `update_class`, `delete_class`, `rename_symbol`, `upsert_attribute`, `delete_attribute`, `create_relation`, `update_relation`, `delete_relation`, `create_module`, `apply_linkml_patch`, `add_ohi_dependency`)
  - `ALL_ONTOLOGY_TOOLS` and `getOntologyTool(name)` in `registry.ts`
  - `previewProposedOperations(ctx, operations): Promise<ProposedChangePlan>`
  - `applyProposedOperationsAtomically(ctx, ontologyId, operations): Promise<ApplyProposalResult>`

- [ ] **Step 1: Write failing tests in `tests/ontology-assistant-write-executor.test.ts`**
      Test:
  1. `previewProposedOperations` validates Zod schemas, populates `describeOperation` summaries, sets `hasDestructiveChanges: true` for `rename_symbol` / `delete_class` / `delete_relation` / `delete_attribute`, and captures `validationErrors` cleanly for bad args without throwing.
  2. `applyProposedOperationsAtomically` executes multiple operations inside a single `db.transaction` passing `tx`, and when step 2 throws, the transaction rolls back and returns `{ ok: false, failedStepIndex: 1, failedTool, error }`.
  3. `apply_linkml_patch` validates YAML via `@neverblink/linkml` / snapshot parser before saving.

- [ ] **Step 2: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-write-executor.test.ts`
      Expected: FAIL.

- [ ] **Step 3: Implement `write-tools.ts`, `executor.ts`, `registry.ts`, and `tx` support in CQ helpers**
  - Ensure every LinkML write tool passes `ctx.tx` to `saveCanonicalOntology(..., { tx: ctx.tx })` and every CQ write tool passes `ctx.tx` to Drizzle so mixed LinkML + CQ proposals commit or roll back together in one transaction.
  - Note: for `rename_symbol`, mutate the symbol key in `linkml_yaml` via `saveCanonicalOntology(..., { tx: ctx.tx })` so `cascadeSymbolRename` updates CQs and facts atomically.

- [ ] **Step 4: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-write-executor.test.ts`
      Expected: PASS.
      Commit: `git add src/features/ontology/server/assistant-tools/ src/features/ontology/server/actions/competency-questions.ts tests/ontology-assistant-write-executor.test.ts && git commit -m "feat(ontology): add write tools, blast-radius preview, and atomic batch executor"`

---

### Task 4: Streamable HTTP MCP Server (`/api/mcp`) & Docker/Antigravity Config

**Files:**

- Create: `src/server/mcp/auth.ts`
- Create: `src/server/mcp/ontology-mcp-server.ts`
- Create: `src/app/api/mcp/route.ts`
- Modify: `deploy/compose.yaml` (forward `KG_MCP_TOKEN` and `KG_MCP_GROUP_KEY` to `app`)
- Modify: `src/features/ontology/README.md` (document `/api/mcp` and Antigravity `mcp_config.json`)
- Test: `tests/ontology-mcp-server.test.ts`

**Interfaces:**

- Consumes: `ALL_ONTOLOGY_TOOLS`, `runWithGroupKey`
- Produces:
  - `authorizeMcpRequest(request: Request): { ok: true; groupKey: string } | { ok: false; status: number; error: string }`
  - `createOntologyMcpServer(groupKey: string): McpServer`
  - `POST`, `GET`, `DELETE` handlers in `src/app/api/mcp/route.ts`

- [ ] **Step 1: Write failing tests in `tests/ontology-mcp-server.test.ts`**
      Test:
  1. `authorizeMcpRequest` returns `401` when `KG_MCP_TOKEN` is unset in production or bearer header is missing/wrong, and returns `{ ok: true, groupKey: "team-a" }` when bearer matches and `x-kg-group-key: team-a` is set.
  2. `POST /api/mcp` with MCP `initialize` and `tools/list` JSON-RPC payloads returns the registered ontology tools (including `list_ontologies`, `add_cq`, `create_class`, `rename_symbol`, `export_ontology`).

- [ ] **Step 2: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-mcp-server.test.ts`
      Expected: FAIL.

- [ ] **Step 3: Implement `auth.ts`, `ontology-mcp-server.ts`, `src/app/api/mcp/route.ts`, and `deploy/compose.yaml`**
  - Use `WebStandardStreamableHTTPServerTransport` in stateless mode (`sessionIdGenerator: undefined`) so each HTTP request in Next.js App Router is handled cleanly without in-memory session affinity issues.
  - Wrap tool execution in `runWithGroupKey(groupKey, () => tool.execute(...))`.

- [ ] **Step 4: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-mcp-server.test.ts`
      Expected: PASS.
      Commit: `git add src/server/mcp/ src/app/api/mcp/route.ts deploy/compose.yaml src/features/ontology/README.md tests/ontology-mcp-server.test.ts && git commit -m "feat(mcp): add Streamable HTTP /api/mcp ontology server with bearer auth"`

---

### Task 5: In-App Ontology Assistant Agent, Apply Route & Fingerprint Endpoint

**Files:**

- Create: `src/features/ontology/server/assistant/agent.ts`
- Create: `src/features/ontology/server/assistant/fingerprint.ts`
- Create: `src/app/api/ontology/assistant/route.ts`
- Create: `src/app/api/ontology/assistant/apply/route.ts`
- Create: `src/app/api/ontology/[id]/fingerprint/route.ts`
- Test: `tests/ontology-assistant-agent.test.ts`

**Interfaces:**

- Consumes: `LlmClient`, `READ_TOOLS`, `previewProposedOperations`, `applyProposedOperationsAtomically`, `assertOntologyDocumentAccess`, `getCurrentGroupKeyOrThrow`
- Produces:
  - `runOntologyAssistantTurn(input: { ontologyId: string; groupKey: string; messages: AssistantChatMessage[]; provider?: SupportedLlmProvider; model?: string; llmClient?: LlmClient }): Promise<AssistantTurnResponse>`
  - `computeOntologyFingerprint(ontologyId: string, groupKey: string): Promise<{ fingerprint: string }>`

- [ ] **Step 1: Write failing tests in `tests/ontology-assistant-agent.test.ts`**
      Test:
  1. `runOntologyAssistantTurn` with a mocked `LlmClient` returning `{ action: "call_read_tool", tool: "list_cqs", args: ... }` followed by `{ action: "final", reply: "...", proposedOperations: [{ tool: "add_cq", args: ... }] }` executes the read tool, does **not** execute `add_cq`, and returns a validated `ProposedChangePlan`.
  2. `runOntologyAssistantTurn` caps read-tool iterations at 4 to prevent infinite loops.
  3. `/api/ontology/assistant/apply` returns HTTP 409/422 with `{ ok: false, failedStepIndex, failedTool, error }` when atomic execution fails.

- [ ] **Step 2: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-agent.test.ts`
      Expected: FAIL.

- [ ] **Step 3: Implement `agent.ts`, `fingerprint.ts`, and the 3 API routes**
  - Use `LlmClient.generateStructured` with a Zod union/discriminated schema (`call_read_tool` vs. `final`) so it works across Gemini, OpenAI, and Ollama/vLLM.
  - `fingerprint.ts` computes a fast SHA-256 over `linkml_yaml`, `ui_layout`, and CQ count/IDs for `ontologyId`.

- [ ] **Step 4: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-agent.test.ts`
      Expected: PASS.
      Commit: `git add src/features/ontology/server/assistant/ src/app/api/ontology/ tests/ontology-assistant-agent.test.ts && git commit -m "feat(ontology): add in-app assistant agent, atomic apply route, and fingerprint API"`

---

### Task 6: Right-Hand Ontology Assistant UI & Live Sync on `/ontology`

**Files:**

- Create: `src/features/ontology/components/ontology-assistant/types.ts`
- Create: `src/features/ontology/components/ontology-assistant/proposed-changes-card.tsx`
- Create: `src/features/ontology/components/ontology-assistant/assistant-message-item.tsx`
- Create: `src/features/ontology/components/ontology-assistant/assistant-input-bar.tsx`
- Create: `src/features/ontology/components/ontology-assistant/ontology-assistant-panel.tsx`
- Modify: `src/features/ontology/components/ontology-shell/detail-panel-shell.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-header.tsx`
- Modify: `src/features/ontology/components/ontology-shell/ontology-shell.tsx`
- Modify: `src/features/ontology/README.md`
- Test: `tests/ontology-assistant-dom.test.ts`

**Interfaces:**

- Consumes: `/api/ontology/assistant`, `/api/ontology/assistant/apply`, `/api/ontology/[id]/fingerprint`
- Produces:
  - `DetailPanelShell` with `activeMode?: "details" | "assistant"`, `onModeChange`, `assistantContent?: ReactNode`
  - `OntologyAssistantPanel` rendered strictly inside `OntologyShell`

- [ ] **Step 1: Write failing DOM tests in `tests/ontology-assistant-dom.test.ts`**
      (Using the `isReactServer && !isChildTest` pattern from `tests/analyst-chat-dom.test.ts`.)
      Test:
  1. `DetailPanelShell` renders the `Details` / `Assistant` segmented toggle when `assistantContent` is provided.
  2. `ProposedChangesCard` renders operation badges, blast-radius warning banner when `hasDestructiveChanges` is true, **Apply Changes** / **Discard** buttons when pending, and an inline error banner when `applyError` is present.
  3. `OntologyAssistantPanel` renders starter CQ/edit chips and input bar.

- [ ] **Step 2: Run test to verify it fails**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-dom.test.ts`
      Expected: FAIL.

- [ ] **Step 3: Implement the UI components and wire into `DetailPanelShell`, `OntologyHeader`, and `OntologyShell`**
  - Keep `OntologyAssistantPanel` mounted/preserved across `Details | Assistant` switches in `DetailPanelShell` (e.g., CSS hidden/block or lifted state in `OntologyShell`) so chat history is never lost when clicking a class on the canvas or when `router.refresh()` fires on external MCP edits!
  - In `OntologyShell`: poll `/api/ontology/[id]/fingerprint` on window `focus` and every 10s while visible; when fingerprint changes (ignoring our own just-applied fingerprint), call `router.refresh()` and show `toast.info("Ontology updated externally")`.

- [ ] **Step 4: Run tests to verify pass and commit**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-assistant-dom.test.ts`
      Expected: PASS.
      Commit: `git add src/features/ontology/components/ontology-assistant/ src/features/ontology/components/ontology-shell/ src/features/ontology/components/ontology-header/ src/features/ontology/README.md tests/ontology-assistant-dom.test.ts && git commit -m "feat(ontology): add right-hand assistant panel with change previews and live sync"`

---

### Task 7: Full Verification Gate (`typecheck`, `lint`, `test`, `build`)

**Files:**

- Modify: `src/features/ontology/README.md` (if any final entry points missed)

- [ ] **Step 1: Run TypeScript typecheck**
      Run: `cmd /c npm exec pnpm -- run typecheck`
      Expected: 0 errors.

- [ ] **Step 2: Run ESLint**
      Run: `cmd /c npm exec pnpm -- run lint`
      Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Run all new assistant & MCP tests**
      Run: `cmd /c node node_modules/tsx/dist/cli.mjs --conditions=react-server --test tests/ontology-mcp-infra.test.ts tests/ontology-assistant-read-tools.test.ts tests/ontology-assistant-write-executor.test.ts tests/ontology-mcp-server.test.ts tests/ontology-assistant-agent.test.ts tests/ontology-assistant-dom.test.ts`
      Expected: All pass.

- [ ] **Step 4: Run Next.js production build**
      Run: `cmd /c npm exec pnpm -- run build`
      Expected: Build succeeds cleanly.
