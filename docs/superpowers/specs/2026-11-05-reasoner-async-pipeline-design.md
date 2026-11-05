# Reasoner Async Job Pipeline & Ontology Canvas Verification Design

- **Date:** 2026-11-05
- **Status:** Approved
- **Feature:** Ontology Header / Canvas Reasoning & Asynchronous Job Execution
- **Specification Scope:** Phase 2 of Modular Microservices Mesh Roadmap

---

## 1. Executive Summary & Intent

`kg-workbench` introduced a modular Python reasoning sidecar (`services/reasoner`) and an event mesh queue (`domain_events`, `job_queue`, `system_services`). While the reasoner worker container is running in Docker and reporting heartbeats, the workbench does not yet trigger asynchronous reasoning jobs from the UI or display background reasoning results.

This design establishes the **end-to-end asynchronous reasoning pipeline**:
1. Users can trigger deep semantic reasoning (formal W3C SHACL shape validation, disjointness consistency checks, and RDFS/OWL entailment materialization) directly from the **Ontology Header**.
2. Execution uses the **Dual-Path Pattern (Fast-Path Await < 2.0s with Asynchronous TanStack Polling Fallback)** to deliver instant feedback for typical ontologies while non-blockingly handling large models.
3. A dedicated **Reasoner Report Modal** displays validation status, constraint violations, and inferred statements.
4. When the reasoner microservice is offline, the UI degrades gracefully with a copyable Docker Compose command to spin it up.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Dual-Path Reliability:** Interactive fast-path for requests completing within 2,000ms; seamless background polling transition for long-running reasoning.
- **Hybrid Semantic Validation (Option 1):**
  - **Oxigraph Schema Consistency:** Detects unsatisfiable classes (inheriting from mutually disjoint classes via transitive `rdfs:subClassOf*`), inheritance cycles, and property domain/range clashes.
  - **pySHACL Instance Shape Validation:** Validates any defined class instance examples against the generated W3C SHACL shapes.
- **Entailment Materialization (Modal Inspection Only):** Computes transitive subclass closures and displays inferred statements in a dedicated tab inside the Reasoner Report Modal.
- **Graceful Offline Degradation:** Check reasoner health matrix before submission; if offline, inform the user and provide the exact command (`bash deploy/scripts/deploy.sh postgres up --profile reasoner`).
- **Zero Schema Migrations:** Fully reuse existing `domain_events`, `job_queue`, and `system_services` tables already deployed in PostgreSQL.

### 2.2 Non-Goals
- **Replacing Client-side Blast Radius:** Pre-flight blast radius calculation continues to run quickly in-process via TypeScript for canvas node moves and deletions.
- **Document Triple Validation in this Milestone:** While the pipeline is designed to be reusable for documents, this milestone strictly focuses on the **Ontology Canvas & Header**. Document fact review will hook into this same queue in a subsequent step.
- **Real-Time Push Sockets:** WebSockets / SSE are excluded to avoid unnecessary deployment friction.
- **Modifying Canvas Graph State with Inferences:** Inferred relations are displayed in the modal report for review, rather than altering or cluttering authored React Flow canvas nodes.

### 2.3 Anti-Goals
- **Blocking Next.js Workers:** Server actions must never block past 2,000ms.
- **Orphaned Outbox Events:** Domain event publishing and job queue creation must be strictly atomic in the same database transaction.

---

## 3. Approaches Considered & Trade-Off Analysis

| Approach | Description | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **A: Dual-Path (Fast-Path Await + Polling)** | Await job in DB up to 2.0s; fallback to TanStack Query polling if still running. | Snappy UX for small models; non-blocking for large models. | Requires a short DB await loop in the server action. | **Selected (User picked Approach A)** |
| **B: Pure Async Queue & Polling** | Always returns `{ jobId }` immediately; client always polls. | Simple server action; no wait loop. | Forces users through loading spinners even for 50ms jobs. | Rejected |
| **C: Server-Sent Events (SSE)** | PostgreSQL `LISTEN/NOTIFY` streaming job states to the browser. | Push notifications without polling. | High architectural and operational overhead across Docker proxies. | Rejected |

---

## 4. Architectural Specifications

### 4.1 Serialization & Event Publishing (`src/features/ontology/server`)
- **Action:** `requestOntologyReasoningAction(ontologyId: string): Promise<ReasonerJobResult | { jobId: string; status: 'pending' }>`
- **Workflow:**
  1. Load complete ontology (classes, relations, attributes, disjointness, and class examples) using existing queries in `src/features/ontology/server`.
  2. Serialize ontology into RDF Turtle format:
     - Ontology schema definitions (Classes, Relations, Disjointness, Subclasses).
     - Concrete class examples as instances (`:example_1 a :ClassA; :attr "val"`).
     - Accompanying W3C SHACL shapes generated via `generateShaclShapes`.
  3. In a single database transaction, call `publishDomainEvent`:
     ```typescript
     await publishDomainEvent(tx, {
       eventType: "ontology.validation_requested",
       aggregateType: "ontology",
       aggregateId: ontologyId,
       payload: {
         ontologyId,
         dataGraph: ontologyTurtle,
         shapesGraph: shaclTurtle,
         inference: "rdfs",
       },
     }, { priority: 100, targetWorker: "reasoner" });
     ```
  4. Enter **Fast-Path Await**:
     - Poll `job_queue` every 250ms for up to 2,000ms.
     - If `status === 'completed'`, return `{ status: 'completed', result: job.result }`.
     - If `status === 'failed'`, throw error or return failure payload with `errorDetails`.
     - If 2,000ms elapses and status is still `pending` or `claimed`, return `{ jobId, status: 'pending' }`.

### 4.2 Job Status Query Handler (`src/app/api/system/jobs/[id]/route.ts`)
- Add `GET` endpoint to retrieve status of any job:
  ```json
  {
    "id": "uuid",
    "status": "pending | claimed | completed | failed",
    "attempts": 1,
    "result": { ... },
    "errorDetails": null
  }
  ```
- Client hook `useReasonerJob(jobId: string | null)`:
  - Enabled when `jobId !== null` and status is `'pending' | 'claimed'`.
  - Refetches every 2,000ms with TanStack Query until terminal state (`completed` or `failed`).

### 4.3 Reasoner Worker Execution (`services/reasoner/src/reasoner/daemon.py`)
- `services/reasoner` already runs the `worker_loop` claiming `workerType='reasoner'`.
- Enhance `execute_job` to handle `ontology.validation_requested`:
  1. **Oxigraph Engine Consistency Check:**
     - Load `dataGraph` into an in-memory Oxigraph RDF store.
     - Check for unsatisfiable classes: SPARQL query over transitive `rdfs:subClassOf*` joined against `owl:disjointWith`.
     - Check for cyclic inheritance: transitive subclass chains where `?c rdfs:subClassOf+ ?c`.
     - Compute inferred subclass relationships not explicitly stated in the source.
  2. **pySHACL Engine Validation:**
     - Validate data graph against `shapesGraph` using `validate_shacl_turtle`.
  3. **Result Assembly:**
     ```json
     {
       "conforms": true,
       "violationCount": 0,
       "violations": [
         {
           "severity": "Violation",
           "focusNode": "class-uuid-or-curie",
           "message": "Class inherits from disjoint classes: Asset and Organization",
           "source": "Oxigraph (Disjointness)"
         }
       ],
       "inferredTriples": [
         {
           "subject": "PhysicalAsset",
           "predicate": "rdfs:subClassOf",
           "object": "Entity",
           "derivation": "Inferred via Asset -> Entity"
         }
       ],
       "reportText": "Validation completed successfully..."
     }
     ```
  4. Calls `/api/system/jobs/[id]/complete` with result.

### 4.4 Frontend UI Components (`src/features/ontology/components`)
1. **Trigger Button in Ontology Header:**
   - Add a "Validate & Reason" button with a Sparkles/Brain icon in `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx`.
   - Displays a pulsing status badge / toast if a background job is running.
2. **Reasoner Report Modal (`reasoner-report-modal.tsx`):**
   - **Header:** Conformance Status Badge (Green "Conforms" / Red "Violations Detected" / Yellow "Reasoner Offline").
   - **Tabs / Sections:**
     - **Violations Tab:** Lists constraint violations with severity, focus node, source engine, message, and quick-jump highlight on canvas.
     - **Inferred Hierarchy Tab:** Shows relations materialized by the reasoner with derivation explanations.
     - **Raw Report Tab:** Collapsible raw SHACL validation output for debugging.
   - **Offline Banner:** If reasoner service is marked offline in `system_services`, shows:
     > "Reasoner service is currently offline. Spin it up with:"
     > `bash deploy/scripts/deploy.sh postgres up --profile reasoner`

---

## 5. Global Constraints & Conventions

- **Windows Compatibility:** All commands and scripts must run cleanly on Windows.
- **Package Manager:** Use `pnpm` exclusively via `npm exec pnpm -- <cmd>`.
- **Routes:** Never hardcode route strings; define new endpoints in `src/lib/routes.ts` (e.g. `routes.api.system.jobStatus(id)`).
- **Styling:** Use Tailwind CSS + shadcn/ui components conforming to `src/app/globals.css`.
- **Type Safety:** Strict TypeScript throughout; zero `any` types.

---

## 6. Verification & Test Plan

1. **Unit & Integration Tests:**
   - `tests/reasoner-job-fastpath.test.ts`: Test `awaitJobResolution` helper with instant resolve vs timeout fallback.
   - `tests/reasoner-routes.test.ts`: Test `GET /api/system/jobs/[id]` route handler.
   - `services/reasoner/tests/test_reasoner.py`: Test Oxigraph disjointness/cycle detection and pySHACL shape validation.
2. **Full Project Verification:**
   - Run `npm exec pnpm -- check` (Lint, typecheck, tests, and production build).
   - Verify live container heartbeat and test job submission against running Docker stack.
