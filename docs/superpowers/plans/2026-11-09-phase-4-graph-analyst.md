# Phase 4: Graph Intelligence & Natural Language Analyst Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Graph Intelligence & Natural Language Analyst subsystem, featuring a dedicated Python microservice (`services/analyst`), a top-level conversational workbench (`/analyst`) with verifiable citations and interactive subgraphs, and a cross-source semantic contradiction detector.

**Architecture:** A Python FastAPI worker (`services/analyst`) claims `analyst.query_requested` and `analyst.drift_requested` jobs from the transactional PostgreSQL `job_queue`. It builds NetworkX directed graphs over accepted facts and mapped tables, extracts multi-hop reasoning subgraphs, and synthesizes answers with exact paragraph/table citations. Next.js App Router hosts a dedicated three-panel workbench (`/analyst`) with chat, collapsible reasoning traces, React Flow subgraph previews, and contradiction resolution.

**Tech Stack:** Next.js 16 (App Router), React 19, React Flow (`@xyflow/react`), Tailwind CSS, Radix UI / shadcn, TanStack Query, Drizzle ORM, PostgreSQL, Python 3.13, FastAPI, NetworkX, HTTPX, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-09-phase-4-graph-analyst-design.md`

## Global Constraints

- Never use `any` unless strictly justified.
- App Router patterns: Keep Client Components inside dedicated subcomponents; use Server Components by default.
- React Flow code must live inside dedicated client components under `src/features/analyst/components/subgraph-preview/`.
- Routes must be imported from `src/lib/routes.ts`.
- Reusable UI elements must reuse `src/components/ui/*` and `src/components/shared/*`.
- Maintain a concise `README.md` in `src/features/analyst/README.md`.
- All tests must pass with `npm exec pnpm -- check`.

## Review Focus

1. **Empty / No Facts Handling:** If an ontology has zero accepted facts or mapped datasets, analyst queries must gracefully explain that the knowledge graph has no accepted data, rather than crashing or hallucinating.
2. **Citation Anchor Integrity:** Paragraph citations in answers must correspond to valid `paragraph_id` or `quote_text` in `document_paragraphs`, and table citations must reference existing `dataset_sources`.
3. **Contradiction Mutual Exclusion:** Detecting conflicting values for functional relations (e.g. `headquarters` in two different cities) must flag distinct, non-overlapping fact pairs and allow independent resolution.
4. **Offline Worker Graceful Degradation:** When `analyst-worker` is offline, `/analyst` displays a clear status banner with the Docker Compose command and falls back cleanly without breaking the page.
5. **Session Isolation:** Chats and message histories must be strictly scoped by `ontology_id` and `group_key`.

---

### Task 1: Database Schema Migrations for Analyst Sessions & Contradictions

**Files:**

- Modify: `src/server/db/schema.ts:530-558`
- Create: `drizzle/YYYYMMDDHHMMSS_phase4_analyst/migration.sql` (via `drizzle-kit generate`)
- Create: `tests/analyst-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**
      Create `tests/analyst-schema.test.ts` testing table declarations for `analystConversations`, `analystMessages`, and `knowledgeContradictions` in `schema.ts`.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-schema.test.ts`.

- [ ] **Step 3: Add schema definitions to `src/server/db/schema.ts`**
  - Add `analystConversations` (id, ontology_id, group_key, title, created_at, updated_at).
  - Add `analystMessages` (id, conversation_id, sender, content, reasoning_trace, subgraph, citations, created_at).
  - Add `knowledgeContradictions` (id, ontology_id, group_key, entity_id, entity_label, relation_name, conflict_type, fact_a, fact_b, explanation, status, resolution_action, created_at, updated_at).

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-schema.test.ts`.

- [ ] **Step 5: Commit schema changes**
      `git add src/server/db/schema.ts tests/analyst-schema.test.ts`
      `git commit -m "feat(analyst): add database schema for conversations and contradictions"`

---

### Task 2: Scaffold `services/analyst` Microservice & Docker Profile

**Files:**

- Create: `services/analyst/Dockerfile`
- Create: `services/analyst/pyproject.toml`
- Create: `services/analyst/src/analyst/__init__.py`
- Create: `services/analyst/src/analyst/config.py`
- Create: `services/analyst/src/analyst/main.py`
- Create: `services/analyst/src/analyst/daemon.py`
- Modify: `deploy/compose.yaml:80-86`
- Create: `services/analyst/tests/test_daemon.py`

- [ ] **Step 1: Write the failing Python test**
      Create `services/analyst/tests/test_daemon.py` verifying heartbeat payload structure, worker claim parameters (`workerType = 'analyst'`), and health endpoint response.

- [ ] **Step 2: Run pytest to confirm failure**
      Run pytest in `services/analyst/tests/`.

- [ ] **Step 3: Implement `services/analyst` worker scaffolding**
  - Setup `pyproject.toml` with `fastapi`, `uvicorn`, `httpx`, `pydantic`, `networkx`, `pytest`.
  - Create `Dockerfile` mirroring `services/tabular/Dockerfile`.
  - Implement `config.py` loading `WORKBENCH_API_URL`, `WORKER_ID`, and polling intervals.
  - Implement `daemon.py` with `heartbeat_loop`, `claim_job`, `complete_job`, `fail_job`, and worker loop.
  - Implement `main.py` with FastAPI lifespan and `/health` route.
  - Add `analyst` service to `deploy/compose.yaml` under profiles `["analyst", "full"]` on port 8040.

- [ ] **Step 4: Run pytest to verify tests pass**
      Run pytest in `services/analyst/tests/`.

- [ ] **Step 5: Commit worker scaffolding**
      `git add services/analyst/ deploy/compose.yaml`
      `git commit -m "feat(analyst): scaffold analyst microservice and compose profile"`

---

### Task 3: In-Memory Multi-Hop Graph Traversal Engine

**Files:**

- Create: `services/analyst/src/analyst/graph_engine.py`
- Create: `services/analyst/tests/test_graph_engine.py`

- [ ] **Step 1: Write failing graph traversal tests**
      Create `services/analyst/tests/test_graph_engine.py` testing:
  - Graph construction from facts, entities, and mapped tabular records.
  - Multi-hop neighborhood extraction given query entity anchors.
  - Shortest path / connective subgraph extraction between multiple query entities.
  - Formatting subgraph nodes and edges for serialization back to Workbench.

- [ ] **Step 2: Run pytest to confirm failure**
      Run pytest in `services/analyst/tests/test_graph_engine.py`.

- [ ] **Step 3: Implement `graph_engine.py` with NetworkX**
  - Implement `build_knowledge_graph(facts, entities, tables) -> nx.MultiDiGraph`.
  - Implement `extract_query_subgraph(graph, anchor_entities, max_hops=2)`.
  - Implement `serialize_subgraph(subgraph) -> SubgraphPayload`.

- [ ] **Step 4: Run pytest to verify tests pass**
      Run pytest in `services/analyst/tests/test_graph_engine.py`.

- [ ] **Step 5: Commit graph engine**
      `git add services/analyst/src/analyst/graph_engine.py services/analyst/tests/test_graph_engine.py`
      `git commit -m "feat(analyst): implement networkx multi-hop graph traversal engine"`

---

### Task 4: Contradiction & Semantic Drift Detection Engine

**Files:**

- Create: `services/analyst/src/analyst/drift_detector.py`
- Create: `services/analyst/tests/test_drift_detector.py`

- [ ] **Step 1: Write failing drift detector tests**
      Create `services/analyst/tests/test_drift_detector.py` testing:
  - Flagging conflicting values for functional relations (e.g. `headquarters`: "Stockholm" vs "Helsinki").
  - Flagging direct negation / opposite relations between the same pair of entities.
  - Generating clean structured explanation and suggested resolution action.

- [ ] **Step 2: Run pytest to confirm failure**
      Run pytest in `services/analyst/tests/test_drift_detector.py`.

- [ ] **Step 3: Implement `drift_detector.py`**
  - Implement `detect_knowledge_contradictions(facts, entities, tables) -> list[ContradictionRecord]`.
  - Add functional relation conflict rules and cross-document value mismatch detectors.

- [ ] **Step 4: Run pytest to verify tests pass**
      Run pytest in `services/analyst/tests/test_drift_detector.py`.

- [ ] **Step 5: Commit drift detector**
      `git add services/analyst/src/analyst/drift_detector.py services/analyst/tests/test_drift_detector.py`
      `git commit -m "feat(analyst): implement contradiction and semantic drift detector"`

---

### Task 5: Backend Actions & Event Mesh Integration for Analyst Queries

**Files:**

- Create: `src/features/analyst/types.ts`
- Create: `src/features/analyst/server/queries/get-conversations.ts`
- Create: `src/features/analyst/server/queries/get-messages.ts`
- Create: `src/features/analyst/server/queries/get-contradictions.ts`
- Create: `src/features/analyst/server/actions/send-query.ts`
- Create: `src/features/analyst/server/actions/create-conversation.ts`
- Create: `src/features/analyst/server/actions/resolve-contradiction.ts`
- Create: `tests/analyst-actions.test.ts`

- [ ] **Step 1: Write failing action tests**
      Create `tests/analyst-actions.test.ts` testing:
  - `createConversationAction` creates a new session in Postgres.
  - `sendQueryAction` persists user message and enqueues `analyst.query_requested` with graph context payload.
  - `resolveContradictionAction` updates status to `resolved` or `dismissed`.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-actions.test.ts`.

- [ ] **Step 3: Implement analyst server queries and actions**
  - Implement `types.ts` with strong TypeScript contracts.
  - Implement queries with group scoping.
  - Implement `send-query.ts` aggregating facts, anchors, and mapped datasets and publishing outbox event.
  - Implement `resolve-contradiction.ts`.

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-actions.test.ts`.

- [ ] **Step 5: Commit backend actions**
      `git add src/features/analyst/ tests/analyst-actions.test.ts`
      `git commit -m "feat(analyst): add server actions and queries for graph analyst"`

---

### Task 6: Analyst Navigation & Shell Layout

**Files:**

- Modify: `src/lib/routes.ts:16-18`
- Modify: `src/components/app-sidebar.tsx:22-30`
- Create: `src/app/(app)/analyst/page.tsx`
- Create: `src/features/analyst/components/analyst-shell/analyst-shell.tsx`
- Create: `src/features/analyst/components/conversation-sidebar/conversation-sidebar.tsx`
- Create: `src/features/analyst/README.md`
- Create: `tests/analyst-navigation-dom.test.ts`

- [ ] **Step 1: Write failing navigation tests**
      Create `tests/analyst-navigation-dom.test.ts` verifying `routes.analyst.root` exists and `app-sidebar.tsx` includes Graph Analyst item.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-navigation-dom.test.ts`.

- [ ] **Step 3: Implement route and shell layout**
  - Add `analyst: { root: "/analyst", conversation: (id: string) => `/analyst?c=${id}` }` to `src/lib/routes.ts`.
  - Add `{ href: routes.analyst.root, label: "Graph Analyst", icon: Sparkles }` to `AppSidebar`.
  - Create `src/app/(app)/analyst/page.tsx` Server Component fetching initial conversations and system services status.
  - Create `AnalystShell` and `ConversationSidebar`.
  - Add `src/features/analyst/README.md`.

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-navigation-dom.test.ts`.

- [ ] **Step 5: Commit navigation and shell**
      `git add src/lib/routes.ts src/components/app-sidebar.tsx src/app/(app)/analyst/ src/features/analyst/ tests/analyst-navigation-dom.test.ts`
      `git commit -m "feat(analyst): create analyst shell and navigation route"`

---

### Task 7: Chat View, Reasoning Trace, and Citation Inspector

**Files:**

- Create: `src/features/analyst/components/chat-view/chat-message-list.tsx`
- Create: `src/features/analyst/components/chat-view/chat-message-item.tsx`
- Create: `src/features/analyst/components/chat-view/chat-input-bar.tsx`
- Create: `src/features/analyst/components/chat-view/reasoning-trace-card.tsx`
- Create: `src/features/analyst/components/citation-drawer/citation-inspector.tsx`
- Create: `tests/analyst-chat-dom.test.ts`

- [ ] **Step 1: Write failing chat and citation DOM tests**
      Create `tests/analyst-chat-dom.test.ts` testing:
  - Markdown body rendering with clickable citation pills.
  - Collapsible reasoning trace expansion and execution step count.
  - Citation inspector drawer rendering quote text and source document name.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-chat-dom.test.ts`.

- [ ] **Step 3: Implement chat components and citation inspector**
  - Implement `chat-input-bar.tsx` with textarea and suggested query pills.
  - Implement `reasoning-trace-card.tsx` displaying step-by-step trace.
  - Implement `chat-message-item.tsx` parsing `[Citation: X]` tags into interactive badges.
  - Implement `citation-inspector.tsx` slide-over drawer displaying document paragraph context.

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-chat-dom.test.ts`.

- [ ] **Step 5: Commit chat and citation components**
      `git add src/features/analyst/components/chat-view/ src/features/analyst/components/citation-drawer/ tests/analyst-chat-dom.test.ts`
      `git commit -m "feat(analyst): implement conversational chat view with citations and reasoning trace"`

---

### Task 8: Interactive React Flow Subgraph Visualizer

**Files:**

- Create: `src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx`
- Create: `src/features/analyst/components/subgraph-preview/subgraph-flow-view.tsx`
- Create: `tests/analyst-subgraph-dom.test.ts`

- [ ] **Step 1: Write failing subgraph DOM tests**
      Create `tests/analyst-subgraph-dom.test.ts` testing that subgraph node labels, class badges, and connecting edges render properly into static markup.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-subgraph-dom.test.ts`.

- [ ] **Step 3: Implement React Flow mini-graph modal**
  - Implement `subgraph-flow-view.tsx` using `@xyflow/react` and `dagre` layout.
  - Implement `analyst-subgraph-modal.tsx` dialog triggered from assistant messages.

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-subgraph-dom.test.ts`.

- [ ] **Step 5: Commit subgraph visualizer**
      `git add src/features/analyst/components/subgraph-preview/ tests/analyst-subgraph-dom.test.ts`
      `git commit -m "feat(analyst): add interactive React Flow subgraph visualizer for query paths"`

---

### Task 9: Contradictions & Semantic Drift View

**Files:**

- Create: `src/features/analyst/components/contradictions-view/contradictions-tab.tsx`
- Create: `src/features/analyst/components/contradictions-view/contradiction-card.tsx`
- Create: `src/features/analyst/components/contradictions-view/resolve-dialog.tsx`
- Create: `tests/analyst-contradictions-dom.test.ts`

- [ ] **Step 1: Write failing contradiction view tests**
      Create `tests/analyst-contradictions-dom.test.ts` testing:
  - Contradiction card rendering side-by-side conflicting statements with quotes.
  - Filter pills (All, Open, Resolved).
  - Calling resolution action when clicking resolve option.

- [ ] **Step 2: Run test to confirm failure**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-contradictions-dom.test.ts`.

- [ ] **Step 3: Implement contradiction management UI**
  - Implement `contradictions-tab.tsx` embedded in `AnalystShell`.
  - Implement `contradiction-card.tsx` with side-by-side diff.
  - Implement `resolve-dialog.tsx` with actions: "Keep Statement A", "Keep Statement B", "Mark Reconciled".

- [ ] **Step 4: Run test to verify it passes**
      Run `cmd /c "node_modules\.bin\tsx.cmd" --test tests/analyst-contradictions-dom.test.ts`.

- [ ] **Step 5: Commit contradiction components**
      `git add src/features/analyst/components/contradictions-view/ tests/analyst-contradictions-dom.test.ts`
      `git commit -m "feat(analyst): implement contradiction management and drift resolution UI"`

---

### Task 10: Full Verification & E2E Validation

**Files:**

- Create: `tests/analyst-e2e-smoke.test.ts`

- [ ] **Step 1: Write and run end-to-end integration test**
      Create `tests/analyst-e2e-smoke.test.ts` testing the complete lifecycle:
  - Create conversation session.
  - Enqueue analyst query with mock graph facts.
  - Complete job with reasoning trace, subgraph, and citations.
  - Fetch conversation messages and verify correct response formatting.

- [ ] **Step 2: Run full check suite**
      Execute `cmd /c "node_modules\.bin\tsc.cmd --noEmit"`, ESLint, all tests, and `next build`.

- [ ] **Step 3: Commit and summarize**
      Ensure working directory is clean and present completion report to user.
