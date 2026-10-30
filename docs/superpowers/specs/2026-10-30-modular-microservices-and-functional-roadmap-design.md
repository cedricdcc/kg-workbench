# Modular Microservices Mesh & Functional Roadmap Design: Incorporating Open-Ontologies and Helix-Foundry

- **Date:** 2026-10-30
- **Status:** Approved
- **Scope:** Architecture & Implementation Roadmap for `kg-workbench`
- **Inspiration Repositories:**
  - [`fabio-rovai/open-ontologies`](https://github.com/fabio-rovai/open-ontologies) (AI-Native Ontology Engine, Blast Radius, SHACL, MCP)
  - [`HelixDB/helix-foundry`](https://github.com/HelixDB/helix-foundry) (DuckDB Connectors, Tabular Schema Induction, PII Masking, Graph Analyst)

---

## 1. Executive Summary

`kg-workbench` currently operates as a Next.js App Router application backed by PostgreSQL and a companion Python FastAPI extractor service (`services/internal-extractor`). While it provides rich visual ontology modeling, Competency Question coverage, OOPS! defect linting, and document-level fact review, its features are primarily tailored to unstructured text extraction and manual ontology curation.

This specification defines the evolution of `kg-workbench` into a **modular, pluggable knowledge engineering platform** powered by an **Event-Driven Message Mesh (Approach 2)**. By adopting key paradigms from `open-ontologies` and `helix-foundry`, `kg-workbench` introduces:

1. **Enterprise Ontology Governance:** Pre-flight "Blast Radius" reports, automated W3C SHACL shape generation and fact validation, and an MCP server bridge for AI coding assistants.
2. **Multi-Source Ingestion & Privacy:** DuckDB-powered tabular data connectors (CSV, Parquet, external SQL databases), AI schema-to-ontology induction, and local PII data masking.
3. **Graph Intelligence & Natural Language Analyst:** Continuous knowledge graph materialization, verifiable natural language querying with paragraph/record citations, and contradiction drift detection.
4. **Pluggable Microservices Mesh:** Dedicated sidecar workers enabled on-demand via Docker Compose profiles, coordinated via a PostgreSQL-native transactional outbox and job queue with zero external broker dependencies.

---

## 2. Upstream Benchmark & Inspiration Analysis

### 2.1 `open-ontologies` (Fabio Rovai)

- **Model Context Protocol (MCP) Server:** Exposes structured tools (`onto_*`) allowing AI coding agents to plan, query, validate, and navigate the ontology with deterministic JSON rather than raw OWL syntax.
- **Infrastructure-as-Code (IaC) Change Management (`oo-plan` / `oo-apply`):** Generates pre-flight blast radius reports and risk scores, identifying locked IRIs and assessing downstream logical dependencies before applying updates.
- **Formal Verification & SHACL:** Enforces W3C SHACL shape constraints, materialized RDFS/OWL entailments, and satisfiability proofs.
- **Semantic Slicing for RAG:** Extracts entailment-preserving ontology slices for LLM prompts to prevent token bloat and context loss.

### 2.2 `helix-foundry` (HelixDB)

- **Multi-Source Data Connectors:** Ingests read-only schemas and records from SQL databases (PostgreSQL, MySQL, Neon, Supabase) and files (CSV, Parquet, JSON) into DuckDB.
- **Automated Schema-to-Ontology Induction:** AI scans database catalogs and tabular samples to draft candidate business ontologies and foreign key mappings.
- **Local-First PII & Sensitive Column Masking:** Auto-masks sensitive fields (emails, credentials, identifiers) locally before passing data samples to external LLMs.
- **Natural Language Analyst ("Ask Your Data"):** Answers plain-English questions across consolidated graphs with verifiable execution steps and snapshot citations.

---

## 3. Decoupling Existing `kg-workbench` Core Capabilities

To allow existing features to participate in the event mesh, their internal boundaries are decoupled into discrete event producers and consumers:

```
+---------------------------------------------------------------------------------------+
|                                    kg-workbench Core                                  |
+------------------------------+---------------------------+----------------------------+
| Component                    | Current Coupled State     | Decoupled Mesh Interface   |
+------------------------------+---------------------------+----------------------------+
| Ontology Core                | Coupled to Drizzle writes | Emits `ontology.*` events  |
| Fact Review Core             | Coupled to Next.js state  | Emits `fact.*` events      |
| Competency Question Core     | In-memory UI metrics      | Emits `cq.*` events        |
| Defect Linter Engine         | Pure TS OOPS! rules       | Can trigger SHACL reasoner |
| Extraction Service           | Direct HTTP REST calls    | Consumes `extraction.*`    |
+------------------------------+---------------------------+----------------------------+
```

1. **Ontology Core (`src/features/ontology/server`):**
   - Decoupled from direct synchronous execution. Schema writes append domain events (`ontology.created`, `ontology.modified`, `ontology.change_proposed`, `ontology.deleted`) inside the same database transaction.
2. **Fact Review Core (`src/features/documents/server`):**
   - Emits `fact.accepted`, `fact.rejected`, and `fact.remapped`.
   - Enables downstream workers (such as the NL Analyst and Graph Materializer) to update knowledge graphs asynchronously.
3. **Extraction Service (`services/internal-extractor`):**
   - Refactored from direct Next.js HTTP POST coupling into a queue-based consumer claiming `extraction.requested` jobs.

---

## 4. Architecture: Event-Driven Message Mesh

```
                        +---------------------------------------------+
                        |           Next.js App (Web UI & API)        |
                        |   - Event Publisher / Transactional Outbox  |
                        |   - Fast-Path Await / SSE Status Gateway    |
                        +----------------------+----------------------+
                                               |
                                     (Transactional Write)
                                               v
                        +---------------------------------------------+
                        |           PostgreSQL Database               |
                        |   - Domain Tables (Ontologies, Docs, Facts) |
                        |   - Event Queue & Outbox (`domain_events`)   |
                        |   - Leased Job Queue (`job_queue`)          |
                        |   - Service Registry (`system_services`)    |
                        +----------------------+----------------------+
                                               |
             +--------------------+------------+------------+--------------------+
             | (claims jobs)      | (claims jobs)           | (claims jobs)      | (claims jobs)
             v                    v                         v                    v
+-----------------------+ +-----------------------+ +--------------------+ +--------------------+
|   Extraction Worker   | |   Reasoner Worker     | |   Tabular Worker   | |   Analyst Worker   |
| (Python FastAPI/RAG)  | |   (Oxigraph / SHACL)  | |   (DuckDB / ETL)   | |  (Graph Q&A / RAG) |
| Neo4j / Ollama / LLM  | | Blast Radius / Infs   | |  Postgres / CSV    | | Citations & Search |
+-----------------------+ +-----------------------+ +--------------------+ +--------------------+
```

### 4.1 Transactional Outbox in PostgreSQL

To eliminate the operational complexity of running separate message brokers (Kafka/RabbitMQ) in local development and production, the queue uses **PostgreSQL Transactional Outbox**:

- State modifications and domain events commit in the exact same ACID transaction.
- Workers claim jobs using `FOR UPDATE SKIP LOCKED`, preventing race conditions across multiple instances.

### 4.2 Database Schema Definitions (Drizzle ORM)

```typescript
// src/server/db/schema.ts additions

// 1. Immutable Event Audit Trail
export const domainEvents = pgTable("domain_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// 2. Transactional Job Queue with Concurrency Leasing
export const jobQueue = pgTable("job_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => domainEvents.id, {
    onDelete: "cascade",
  }),
  targetWorker: varchar("target_worker", { length: 50 }).notNull(), // 'reasoner' | 'extractor' | 'tabular' | 'analyst'
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending' | 'claimed' | 'completed' | 'failed'
  priority: integer("priority").default(0).notNull(), // Higher integer = claimed first
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lockedBy: varchar("locked_by", { length: 100 }), // Worker instance ID
  lockedUntil: timestamp("locked_until"),
  result: jsonb("result"),
  errorDetails: text("error_details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// 3. Worker Discovery and Health Matrix
export const systemServices = pgTable("system_services", {
  id: varchar("id", { length: 50 }).primaryKey(), // e.g. 'reasoner-worker'
  displayName: varchar("display_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).default("offline").notNull(), // 'online' | 'degraded' | 'offline'
  capabilities: jsonb("capabilities").notNull(), // e.g. ['blast_radius', 'shacl_validation']
  lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),
  metadata: jsonb("metadata"), // version, latency, resource statistics
})
```

### 4.3 Worker Concurrency & Lease Query

Workers lease tasks via:

```sql
UPDATE job_queue
SET
  status = 'claimed',
  locked_by = :worker_id,
  locked_until = NOW() + INTERVAL '60 seconds',
  attempts = attempts + 1,
  updated_at = NOW()
WHERE id = (
  SELECT id FROM job_queue
  WHERE target_worker = :worker_type
    AND status = 'pending'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### 4.4 Client Synchronization (Dual-Path)

1. **Interactive Fast-Path (< 2 seconds):**
   - Server actions queue high-priority tasks (`priority = 100`, e.g., canvas Blast Radius preview).
   - The server action awaits the job resolution in PostgreSQL for up to 2,000ms. If completed within the window, the result is returned synchronously to the UI without client polling.
2. **Long-Running Path (> 2 seconds):**
   - The server action returns the `jobId` immediately.
   - Client UI subscribes via Server-Sent Events (`/api/system/events/stream?jobId=...`) or short-polls using TanStack Query.

### 4.5 Resilience & Dead-Letter Queue (DLQ)

- **Automatic Retries:** Failed jobs retry up to `maxAttempts` (default 3) with exponential backoff: $2^{\text{attempts}} \times 5\text{s}$.
- **DLQ Retention:** When `attempts >= maxAttempts`, the job is marked `failed` with stack trace in `error_details`.
- **Administrative Controls:** The Settings UI provides 1-click "Retry Job" or "Discard" actions.

---

## 5. Service Topology & Deployment Profiles

Microservices are packaged in `deploy/` and toggled using Docker Compose profiles:

- `deploy/compose.yaml`:
  - Base profile runs `postgres` and `app` (Next.js).
- Profiles:
  - `--profile reasoner`: Launches `reasoner-worker` (`services/reasoner`, Oxigraph / SHACL).
  - `--profile tabular`: Launches `tabular-worker` (`services/tabular`, DuckDB ETL).
  - `--profile analyst`: Launches `analyst-worker` (`services/analyst`, Graph/Vector Q&A).
  - `--profile full`: Runs all sidecars simultaneously.
- **Graceful Degradation:** If a worker is offline, its corresponding UI features render a clean callout banner displaying the service status and the exact command to spin it up (e.g., `bash deploy/scripts/deploy.sh postgres up --profile reasoner`).

---

## 6. The 4-Phase Implementation Roadmap

```
+-----------------------------------------------------------------------------------+
| Phase 1: Event Mesh Backbone & Core Decoupling                                    |
| - Drizzle schema migrations for `domain_events`, `job_queue`, `system_services`   |
| - Outbox dispatcher utility and atomic transaction helper                         |
| - Service Registry heartbeat daemon                                               |
| - Migrate internal-extractor to queue consumer                                    |
| - Settings UI: "Connected Services & Worker Health Matrix"                        |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 2: Enterprise Ontology Governance & Verification (from `open-ontologies`)   |
| - `reasoner-worker` container (Oxigraph / W3C SHACL engine)                       |
| - Pre-flight "Blast Radius" report (`oo-plan` style) for canvas & schema edits     |
| - Automated W3C SHACL shape generation from classes & attributes                  |
| - SHACL constraint validation against extracted facts                             |
| - Headless MCP Server bridge (`onto_*` tools for Claude Code, Cursor, Antigravity)|
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 3: Multi-Source Tabular Ingestion & Privacy (from `helix-foundry`)          |
| - `tabular-worker` container (DuckDB ETL engine)                                  |
| - Tabular connectors (CSV, Parquet, Excel, read-only PostgreSQL/MySQL)            |
| - AI Schema-to-Ontology induction (draft classes/relations from tables)           |
| - Local PII & Sensitive Data Masking pipeline before LLM calls                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Phase 4: Graph Intelligence & Natural Language Analyst (inspired by both)         |
| - `analyst-worker` container (Hybrid Graph + Vector RAG)                          |
| - "Ask Your Knowledge Graph" natural language query workbench                     |
| - Verifiable answer execution steps with exact paragraph & table citations        |
| - Semantic drift detection (flags conflicting facts across documents)             |
+-----------------------------------------------------------------------------------+
```

### Phase 1: Event Mesh Backbone & Core Decoupling

- **Target Outcome:** Next.js and existing extractor communicate via PostgreSQL transactional outbox.
- **Key Tasks:**
  1. Add `domain_events`, `job_queue`, and `system_services` tables to `src/server/db/schema.ts` and generate Drizzle migration.
  2. Implement `publishDomainEvent(tx, event)` helper in `src/server/events/outbox.ts`.
  3. Refactor `services/internal-extractor` Python service to poll `job_queue` for `target_worker = 'extractor'`.
  4. Create `src/app/api/system/services/heartbeat/route.ts` and background worker heartbeat ping.
  5. Build "System Services" dashboard under `src/features/settings` displaying worker health, queue latency, and compose commands.

### Phase 2: Enterprise Ontology Governance & Verification (`open-ontologies`)

- **Target Outcome:** Pre-flight change impact analysis, SHACL constraint validation, and MCP agent bridge.
- **Key Tasks:**
  1. Scaffold `services/reasoner` (Oxigraph + pySHACL or Rust Oxigraph worker).
  2. **Blast Radius Analysis (`oo-plan`):**
     - Worker calculates affected Competency Questions, connected facts in documents, and broken subclass hierarchies upon proposed class/relation deletion or modification.
     - Build "Blast Radius Preview" slide-over drawer on React Flow canvas and schema detail panels.
  3. **SHACL Generation & Fact Validation:**
     - Compile ontology classes, required attributes, and datatypes into W3C SHACL shapes.
     - Validate extracted facts in `src/features/documents` against SHACL shapes before accepting.
  4. **MCP Server Bridge:**
     - Implement stdio / SSE MCP server (`src/server/mcp/`) exposing typed tools (`get_ontology_schema`, `check_blast_radius`, `validate_triples_shacl`, `evaluate_cq_coverage`).

### Phase 3: Multi-Source Tabular Ingestion & Privacy (`helix-foundry`)

- **Target Outcome:** Tabular connectors, schema-to-ontology induction, and pre-LLM PII masking.
- **Key Tasks:**
  1. Scaffold `services/tabular` (DuckDB worker).
  2. Implement connectors for CSV, Parquet, Excel, and read-only PostgreSQL/MySQL database connections.
  3. **Schema-to-Ontology Induction:**
     - Worker analyzes table columns, data samples, and foreign keys to propose candidate ontology modules, classes, and relations.
     - Review UI in Ontology feature to accept, tweak, or reject proposed entities.
  4. **PII Masking Pipeline:**
     - Implement deterministic regex and NER masking service.
     - Sensitive tokens (names, emails, credentials) are replaced with salted placeholder tokens before LLM dispatch and re-hydrated on return.

### Phase 4: Graph Intelligence & Natural Language Analyst

- **Target Outcome:** Conversational Q&A over accepted facts with paragraph citations.
- **Key Tasks:**
  1. Scaffold `services/analyst` (Graph traversal + vector embedding engine).
  2. Continuous materialization: worker listens to `fact.accepted` events and updates graph index.
  3. **"Ask Your Knowledge Graph" Workbench:**
     - Dedicated conversational UI allowing users to ask plain-English questions.
     - Multi-hop reasoning returning answers backed by interactive graph node previews and exact document paragraph anchors.
  4. **Contradiction & Drift Detection:**
     - Flags incoming facts that conflict with already accepted knowledge graph facts.

---

## 7. Spec Self-Review Checklist

- [x] **Placeholder Scan:** No "TBD", "TODO", or unaddressed placeholders.
- [x] **Internal Consistency:** Architecture, schema definitions, queue leasing, and roadmap deliverables are fully aligned.
- [x] **Scope Check:** Decomposed into 4 logical, sequential phases. Phase 1 provides the standalone foundation before Phase 2/3/4 services are built.
- [x] **Ambiguity Check:** Dual client synchronization (Fast-Path < 2s vs Long-Running via SSE/polling) and PostgreSQL `SKIP LOCKED` lease mechanics are explicitly specified.
