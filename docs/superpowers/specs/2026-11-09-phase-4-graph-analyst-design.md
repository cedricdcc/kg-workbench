# Phase 4: Graph Intelligence & Natural Language Analyst Design Specification

## 1. Executive Summary & Context

**Phase 4** of the KG Workbench roadmap completes the transition from an ontology modeling and document extraction workbench into an active, verifiable **Knowledge Graph Intelligence Platform**.

While Phases 1, 2, and 3 built the asynchronous event mesh (`job_queue`), enterprise SHACL reasoner (`services/reasoner`), and multi-source DuckDB ingestion (`services/tabular`), knowledge currently sits in partitioned silos: accepted document facts, tabular datasets, and ontology classes.

Phase 4 introduces:

1. **`services/analyst` Microservice:** A dedicated Python worker container (`--profile analyst`) executing hybrid graph traversal (NetworkX), semantic search, multi-hop reasoning, and contradiction drift detection.
2. **"Ask Your Knowledge Graph" Conversational Workbench (`/analyst`):** A top-level dedicated UI allowing users to ask natural language questions across all accepted document facts and mapped tabular data, complete with verifiable reasoning traces, exact paragraph/table citations, and interactive subgraph previews.
3. **Contradiction & Semantic Drift Engine:** Automated detection of conflicting facts across documents and tabular sources (e.g. contradictory attributes, functional relation violations) with actionable reconciliation actions.

---

## 2. Architecture & Service Topology

```
+----------------------------------------------------------------------------------------------------+
|                                     Next.js App Router (app:3000)                                  |
|                                                                                                    |
|  /analyst (Graph Analyst Workbench) <---> Server Actions & Queries                                 |
|  - Conversational Q&A               <---> publishDomainEvent(tx, 'analyst.query_requested')        |
|  - Interactive Subgraph View        <---> publishDomainEvent(tx, 'analyst.drift_requested')        |
|  - Citation Inspector Drawer        <---> Job status polling & optimistic results                  |
+----------------------------------------------------------------------------------------------------+
                                      |                     ^
                     Enqueues jobs to |                     | Heartbeats & completes jobs
                                      v                     |
+----------------------------------------------------------------------------------------------------+
|                              PostgreSQL 16 (db:5432 / local:5433)                                  |
|  - domain_events: 'analyst.query_requested', 'analyst.drift_requested', 'fact.accepted'             |
|  - job_queue: target_worker = 'analyst', SKIP LOCKED leasing, attempts, result payload             |
|  - facts, document_entities, document_paragraphs, fact_anchors, dataset_sources                     |
|  - analyst_conversations, analyst_messages, contradiction_records (New tables)                     |
+----------------------------------------------------------------------------------------------------+
                                      ^                     |
                        Polls / Claim |                     | Updates via complete endpoint
                                      |                     v
+----------------------------------------------------------------------------------------------------+
|                             `analyst-worker` Container (services/analyst)                          |
|  - Profile: ['analyst', 'full'] on port 8040                                                       |
|  - Daemon loop polling /api/system/jobs/claim with workerType = 'analyst'                          |
|  - Graph Engine: NetworkX in-memory multi-hop traversal & sub-graph induction                      |
|  - Vector / Semantic Search: Inverted lexical + vector cosine similarity                           |
|  - Contradiction Detector: Functional relation checks, mutual exclusion, value conflicts            |
|  - Answer Generator: Unified LLM prompt synthesis with strict markdown citation tags               |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Database Schema Extensions

We add persistent conversation history and contradiction tracking to `src/server/db/schema.ts`:

### 3.1 `analyst_conversations`

Stores user query sessions.

```ts
export const analystConversations = pgTable("analyst_conversations", {
  id: generatedId(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "cascade",
  }),
  group_key: text("group_key").notNull().default("shared"),
  title: text("title").notNull().default("New Analysis"),
  created_at: created_at(),
  updated_at: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
})
```

### 3.2 `analyst_messages`

Stores conversational Q&A turns with reasoning traces, subgraph snapshots, and citations.

```ts
export const analystMessages = pgTable("analyst_messages", {
  id: generatedId(),
  conversation_id: uuid("conversation_id")
    .references(() => analystConversations.id, { onDelete: "cascade" })
    .notNull(),
  sender: text("sender").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  reasoning_trace:
    jsonb("reasoning_trace").$type<Array<{ step: string; detail: string }>>(),
  subgraph: jsonb("subgraph").$type<{
    nodes: Array<{
      id: string
      label: string
      kind: string
      metadata?: Record<string, unknown>
    }>
    edges: Array<{ id: string; source: string; target: string; label: string }>
  }>(),
  citations: jsonb("citations").$type<
    Array<{
      sourceType: "document" | "table"
      sourceId: string
      sourceName: string
      paragraphIndex?: number
      pageFrom?: number
      pageTo?: number
      quoteText?: string
      tableRowKey?: string
    }>
  >(),
  created_at: created_at(),
})
```

### 3.3 `knowledge_contradictions`

Stores surfaced contradictions and semantic drift across facts and datasets.

```ts
export const knowledgeContradictions = pgTable("knowledge_contradictions", {
  id: generatedId(),
  ontology_id: uuid("ontology_id")
    .references(() => ontologyDocuments.id, { onDelete: "cascade" })
    .notNull(),
  group_key: text("group_key").notNull().default("shared"),
  entity_id: text("entity_id").notNull(),
  entity_label: text("entity_label").notNull(),
  relation_name: text("relation_name").notNull(),
  conflict_type: text("conflict_type").notNull(), // 'value_mismatch' | 'temporal_drift' | 'negation'
  fact_a: jsonb("fact_a").notNull(), // { id, value, documentTitle, quoteText, createdAt }
  fact_b: jsonb("fact_b").notNull(), // { id, value, documentTitle, quoteText, createdAt }
  explanation: text("explanation").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'resolved' | 'dismissed'
  resolution_action: text("resolution_action"),
  created_at: created_at(),
  updated_at: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
})
```

---

## 4. `services/analyst` Microservice Design

### 4.1 Folder Structure

```
services/analyst/
├── Dockerfile
├── pyproject.toml
├── README.md
├── src/
│   └── analyst/
│       ├── __init__.py
│       ├── config.py             # Settings (worker_id, workbench_api_url, heartbeat_interval)
│       ├── main.py               # FastAPI app, lifespan, health endpoint
│       ├── daemon.py             # Heartbeat loop & worker loop claiming 'analyst' jobs
│       ├── graph_engine.py       # NetworkX multi-hop subgraph extractor
│       ├── query_synthesizer.py  # LLM prompt builder & citation generator
│       └── drift_detector.py     # Contradiction & drift evaluation rules
└── tests/
    ├── test_daemon.py
    ├── test_graph_engine.py
    └── test_drift_detector.py
```

### 4.2 Query Execution Lifecycle

1. User enters natural language prompt in the UI:
   `"Which institutions in the Baltic region have research focus on marine ecology?"`
2. Next.js creates user message and publishes `analyst.query_requested` event.
3. Next.js gathers contextual graph payload:
   - Accepted `facts` for the active ontology/group.
   - Associated `fact_anchors` and `document_paragraphs`.
   - Mapped `dataset_sources` (sample rows and mapped classes/attributes).
4. `analyst-worker` claims the job:
   - Builds in-memory directed graph of facts and dataset records.
   - Performs entity recognition and 2-hop neighborhood expansion around relevant query nodes.
   - Extracts relevant supporting paragraphs and table cells.
   - Generates multi-hop reasoning steps and structured response with verifiable citations.
   - Extracts traversed subgraph nodes and edges.
5. Worker completes job with payload: `{ answer, reasoningTrace, subgraph, citations }`.
6. Next.js stores assistant message and updates conversation in Postgres.
7. Frontend polls/receives completed response and renders text, interactive subgraph, and citation links.

### 4.3 Semantic Drift & Contradiction Detection

1. Triggered on-demand via the UI or asynchronously when new facts are accepted.
2. Worker analyzes the graph for:
   - **Functional relation violation:** An entity having multiple distinct objects for a relation marked as functional or single-valued (e.g. `headquarters`, `dateOfBirth`, `isoCode`).
   - **Contradictory values:** Conflicting attribute values extracted from two different documents for the same entity.
   - **Dataset vs. Document divergence:** Tabular dataset specifying property $V_1$ while accepted document facts specify $V_2$.
3. Detected discrepancies are returned as structured `knowledge_contradictions` records.

---

## 5. UI Workbench Design (`/analyst`)

### 5.1 Route & Navigation

- Path: `src/app/(app)/analyst/page.tsx`
- Navigation item in `src/components/app-sidebar.tsx`:
  - Label: **"Graph Analyst"**
  - Icon: `Bot` or `Sparkles`
  - Tooltip: "Ask Your Knowledge Graph"

### 5.2 Layout & Components (`src/features/analyst/components/`)

```
src/features/analyst/
├── README.md
├── types.ts
├── hooks/
│   ├── use-analyst-conversation.ts
│   └── use-contradictions.ts
├── server/
│   ├── actions/
│   │   ├── send-query.ts
│   │   ├── create-conversation.ts
│   │   ├── delete-conversation.ts
│   │   ├── resolve-contradiction.ts
│   │   └── run-drift-analysis.ts
│   └── queries/
│       ├── get-conversations.ts
│       ├── get-messages.ts
│       └── get-contradictions.ts
└── components/
    ├── analyst-shell/                 # Main responsive 3-pane workbench container
    ├── conversation-sidebar/          # Past chats list + "New Analysis" + Search
    ├── chat-view/
    │   ├── chat-message-list.tsx      # Streamed & historical messages
    │   ├── chat-message-item.tsx      # Markdown body, citation pills, action buttons
    │   ├── chat-input-bar.tsx         # Query input + suggested prompt chips
    │   └── reasoning-trace-card.tsx   # Step-by-step verifiable reasoning collapsible
    ├── subgraph-preview/
    │   └── analyst-subgraph-modal.tsx # React Flow mini-graph showing traversed reasoning path
    ├── citation-drawer/
    │   └── citation-inspector.tsx     # Slide-over displaying exact paragraph text & source
    ├── contradictions-view/
    │   ├── contradictions-tab.tsx     # Tab switcher between "Chat Q&A" and "Drift & Contradictions"
    │   ├── contradiction-card.tsx     # Side-by-side conflicting evidence comparison
    │   └── resolve-dialog.tsx         # Action to accept Fact A, accept Fact B, or mark resolved
    └── offline-callout/
        └── analyst-offline-banner.tsx # Renders status and compose command if worker is offline
```

### 5.3 Offline Graceful Degradation

If `analyst-worker` is offline (reported by `system_services`), the workbench displays an offline banner:
`"Graph Analyst worker is offline. Run 'bash deploy/scripts/deploy.sh postgres up --profile analyst' or start the full stack."`
The UI also offers an instant fallback to local Next.js direct LLM synthesis over accepted facts.

---

## 6. Implementation Milestones

### Milestone 4.1: Microservice Scaffolding & Knowledge Indexing

1. Create `services/analyst` directory with `pyproject.toml`, `Dockerfile`, `config.py`, `daemon.py`, and `main.py`.
2. Add `analyst` service definition to `deploy/compose.yaml` under profiles `["analyst", "full"]`.
3. Implement `graph_engine.py` with NetworkX for in-memory graph construction and multi-hop neighborhood extraction.
4. Add unit tests in `services/analyst/tests/test_graph_engine.py` and `test_daemon.py`.

### Milestone 4.2: Conversational "Ask Your KG" Workbench & Citations

1. Create database schema tables `analyst_conversations` and `analyst_messages` in `src/server/db/schema.ts` and generate migration.
2. Implement backend actions and queries (`send-query.ts`, `get-messages.ts`, `get-conversations.ts`).
3. Add `/analyst` route in `src/lib/routes.ts` and sidebar entry in `src/components/app-sidebar.tsx`.
4. Build `AnalystShell`, `ChatView`, `ReasoningTraceCard`, `AnalystSubgraphModal` (React Flow), and `CitationInspector`.
5. Add unit and DOM tests for analyst message rendering and citation pill linking.

### Milestone 4.3: Contradiction & Semantic Drift Detection

1. Create database schema table `knowledge_contradictions` in `src/server/db/schema.ts`.
2. Implement `drift_detector.py` in `services/analyst` with rule-based and LLM-assisted contradiction detection.
3. Build `ContradictionsTab`, `ContradictionCard`, and `resolve-contradiction.ts` action.
4. Add unit and integration tests verifying contradiction detection and resolution workflows.

---

## 7. Verification Plan

1. **Worker Tests:** Run `pytest` in `services/analyst/` verifying heartbeat, job claiming, graph traversal, and drift detection.
2. **Frontend DOM Tests:** Test `AnalystShell`, citation click handlers, reasoning trace toggle, and contradiction resolution dialog.
3. **Integration & E2E:** End-to-end smoke test verifying query submission -> worker claim -> reasoning execution -> message persistence -> citation inspection.
4. **Build & Typecheck:** Run full `pnpm check` (ESLint, `tsc --noEmit`, all unit tests, Next.js build).
