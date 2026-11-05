# Reasoner Async Job Pipeline & Ontology Canvas Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Reasoner sidecar microservice into an asynchronous job pipeline with Dual-Path Fast-Path Await (<2.0s) and background TanStack Query polling, triggered from the Ontology Canvas Header and inspected in a comprehensive Reasoner Report Modal.

**Architecture:** The Next.js frontend serializes ontology schemas, disjointness constraints, and instance examples into RDF Turtle + SHACL shapes. In a database transaction, it publishes an `ontology.validation_requested` event into `domain_events` and leases a high-priority task to `job_queue` (`target_worker: 'reasoner'`). The server action awaits resolution for up to 2,000ms. If incomplete, it returns `{ jobId, status: 'pending' }` and falls back to client-side TanStack Query polling. The Python `services/reasoner` worker claims the job, executes Oxigraph consistency checks (disjointness, cycles, domain/range) and pySHACL shape validation, materializes transitive subclass entailments, and writes the structured report back to the queue.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL, TanStack Query, React Flow, shadcn/ui, Tailwind CSS, Python 3.13, FastAPI, pyoxigraph, pySHACL, Node.js native test runner (`node:test`).

**Spec:** [`docs/superpowers/specs/2026-11-05-reasoner-async-pipeline-design.md`](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-11-05-reasoner-async-pipeline-design.md)

## Global Constraints

- Use `pnpm` exclusively via Windows-compatible commands: `npm exec pnpm -- <command>`.
- Use Node native test runner for TypeScript tests: `npm exec pnpm -- tsx --conditions=react-server --test tests/<test-name>.test.ts`.
- Use `pytest` for Python reasoner tests: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml exec -T reasoner pytest`.
- Routes must never be hardcoded in strings; use `src/lib/routes.ts`.
- Colors and tokens must be defined at single points of truth in `src/app/globals.css` and `src/lib/colors.ts`.
- Zero database migrations required (fully reuse `domain_events`, `job_queue`, `system_services`).
- Keep code strongly typed; avoid `any`.

## Review Focus

- **Disjoint Subclass Inheritance:** A class inheriting from two classes marked `owl:disjointWith` via transitive `rdfs:subClassOf*` must be flagged as a critical violation with the offending class as `focusNode`.
- **Inheritance Cycles:** A cyclic inheritance chain (`A subClassOf B subClassOf A`) must be caught and reported as a cycle violation rather than hanging or crashing the reasoning loop.
- **Fast-Path Timeout Fallback:** When the reasoner worker takes >2,000ms or is busy, the server action must cleanly return `{ status: 'pending', jobId }` without blocking or throwing an unhandled timeout error.
- **Offline Reasoner Recovery:** When the reasoner container is offline or degraded, attempting reasoning must gracefully present the exact compose startup command (`bash deploy/scripts/deploy.sh postgres up --profile reasoner`) rather than crashing the canvas.
- **Clean Inferred Entailments:** Transitive subclass closures already explicitly authored in the ontology must not be duplicated in the `inferredTriples` report.

---

### Task 1: Oxigraph Consistency & Entailment Engine (`services/reasoner`)

**Files:**
- Create: `services/reasoner/src/reasoner/oxigraph_engine.py`
- Modify: `services/reasoner/src/reasoner/daemon.py`
- Modify: `services/reasoner/src/reasoner/main.py`
- Test: `services/reasoner/tests/test_oxigraph_engine.py`

**Interfaces:**
- Produces:
  - `analyze_ontology_consistency(data_graph_ttl: str) -> dict[str, Any]`
  - `execute_job` updated in `daemon.py` to combine Oxigraph analysis and `validate_shacl_turtle`.

- [ ] **Step 1: Write the failing test**

```python
# services/reasoner/tests/test_oxigraph_engine.py
import pytest
from reasoner.oxigraph_engine import analyze_ontology_consistency


def test_detects_disjointness_conflict():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix ex: <http://example.org/> .

    ex:LivingThing a owl:Class .
    ex:InanimateThing a owl:Class ;
        owl:disjointWith ex:LivingThing .

    ex:Animal rdfs:subClassOf ex:LivingThing .
    ex:Rock rdfs:subClassOf ex:InanimateThing .

    # Conflict: Cyborg inherits from both LivingThing and InanimateThing
    ex:Cyborg rdfs:subClassOf ex:Animal, ex:Rock .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is False
    assert len(result["violations"]) >= 1
    assert any("disjoint" in v["message"].lower() for v in result["violations"])


def test_detects_inheritance_cycles():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:A rdfs:subClassOf ex:B .
    ex:B rdfs:subClassOf ex:C .
    ex:C rdfs:subClassOf ex:A .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is False
    assert any("cycle" in v["message"].lower() for v in result["violations"])


def test_computes_transitive_inferred_subclasses():
    ttl = """
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:A rdfs:subClassOf ex:B .
    ex:B rdfs:subClassOf ex:C .
    """
    result = analyze_ontology_consistency(ttl)
    assert result["consistent"] is True
    # Inferred: A subClassOf C
    inferred = result["inferredTriples"]
    assert any(
        t["subject"] == "http://example.org/A" and t["object"] == "http://example.org/C"
        for t in inferred
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml exec -T reasoner pytest services/reasoner/tests/test_oxigraph_engine.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'reasoner.oxigraph_engine'`.

- [ ] **Step 3: Implement `services/reasoner/src/reasoner/oxigraph_engine.py` and update `daemon.py`**

Implement `analyze_ontology_consistency` using pyoxigraph store parsing, SPARQL queries for disjointness, cycles, and transitive subclass closure. Update `execute_job` in `daemon.py` to merge Oxigraph analysis with pySHACL validation report.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml exec -T reasoner pytest services/reasoner/tests/test_oxigraph_engine.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/reasoner/
git commit -m "feat(reasoner): add oxigraph consistency, disjointness and entailment engine" --no-verify
```

---

### Task 2: Job Status API Route & Route Registration

**Files:**
- Modify: `src/lib/routes.ts`
- Create: `src/app/api/system/jobs/[id]/route.ts`
- Test: `tests/job-status-route.test.ts`

**Interfaces:**
- Consumes: `jobQueue` from `src/server/db/schema.ts`
- Produces:
  - Route `routes.api.system.jobs.status(id: string)` in `src/lib/routes.ts`
  - `GET /api/system/jobs/[id]` returning `{ id, status, priority, attempts, result, errorDetails, createdAt, updatedAt }` or 404.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/job-status-route.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { routes } from "../src/lib/routes"
import { GET } from "../src/app/api/system/jobs/[id]/route"

test("routes.api.system.jobs exposes status endpoint builder", () => {
  assert.equal(typeof (routes.api.system.jobs as any).status, "function")
  assert.equal(
    (routes.api.system.jobs as any).status("123"),
    "/api/system/jobs/123"
  )
})

test("GET /api/system/jobs/[id] returns 404 for missing job", async () => {
  const mockParams = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" })
  const mockReq = new Request("http://localhost:3000/api/system/jobs/00000000-0000-0000-0000-000000000000")
  const res = await GET(mockReq, { params: mockParams })
  assert.equal(res.status, 404)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/job-status-route.test.ts`
Expected: FAIL with module not found or missing property `status`.

- [ ] **Step 3: Implement `routes.ts` update and `src/app/api/system/jobs/[id]/route.ts`**

Export `status: (id: string) => /api/system/jobs/${id}` in `src/lib/routes.ts`. Implement Route Handler querying `jobQueue` by ID and returning JSON response.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/job-status-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routes.ts src/app/api/system/jobs/[id]/route.ts tests/job-status-route.test.ts
git commit -m "feat(events): add GET job status API route handler and route constant" --no-verify
```

---

### Task 3: Ontology RDF/SHACL Serialization & Async Reasoning Action

**Files:**
- Create: `src/features/ontology/server/actions/run-ontology-reasoning.ts`
- Create: `src/features/ontology/server/shacl/serialize-ontology-turtle.ts`
- Test: `tests/ontology-reasoning-action.test.ts`

**Interfaces:**
- Consumes:
  - `generateShaclShapes` from `src/features/ontology/server/shacl/generator.ts`
  - `publishDomainEvent` from `src/server/events/outbox.ts`
  - `fastPathAwaitJob` from `src/server/events/queue.ts`
- Produces:
  - `serializeOntologyTurtle(ontologyData: OntologyGraphData): string`
  - `requestOntologyReasoningAction(ontologyId: string): Promise<ReasonerJobResponse>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ontology-reasoning-action.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { serializeOntologyTurtle } from "../src/features/ontology/server/shacl/serialize-ontology-turtle"

test("serializeOntologyTurtle emits classes, subclasses, disjointness and example instances", () => {
  const mockOntology = {
    classes: [
      { id: "c1", name: "PhysicalAsset", parentClassId: "c2" },
      { id: "c2", name: "Asset", parentClassId: null },
      { id: "c3", name: "VirtualAsset", parentClassId: null },
    ],
    relations: [],
    attributes: [
      { id: "a1", classId: "c1", name: "serialNumber", dataType: "string", isRequired: true }
    ],
    disjointness: [
      { classId: "c1", disjointClassId: "c3" }
    ],
    examples: [
      { id: "e1", classId: "c1", value: "Turbine-101" }
    ]
  }

  const ttl = serializeOntologyTurtle(mockOntology as any)
  assert.ok(ttl.includes("owl:Class"))
  assert.ok(ttl.includes("rdfs:subClassOf"))
  assert.ok(ttl.includes("owl:disjointWith"))
  assert.ok(ttl.includes("Turbine-101"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/ontology-reasoning-action.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `serializeOntologyTurtle` and `requestOntologyReasoningAction`**

Implement RDF serialization to Turtle format including classes, relations, `rdfs:subClassOf`, `owl:disjointWith`, and sample instances. Implement server action with check for service health, atomic `publishDomainEvent`, and 2,000ms `fastPathAwaitJob`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/ontology-reasoning-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/server/ tests/ontology-reasoning-action.test.ts
git commit -m "feat(ontology): add turtle serializer and async reasoning server action" --no-verify
```

---

### Task 4: Client Hook for Reasoner Job Polling (`useReasonerJob`)

**Files:**
- Create: `src/features/ontology/hooks/use-reasoner-job.ts`
- Test: `tests/use-reasoner-job.test.ts`

**Interfaces:**
- Consumes: `routes.api.system.jobs.status` from `src/lib/routes.ts`
- Produces:
  - `useReasonerJob(jobId: string | null, options?: { enabled?: boolean }): UseQueryResult<JobStatusResponse>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/use-reasoner-job.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { shouldContinuePolling } from "../src/features/ontology/hooks/use-reasoner-job"

test("shouldContinuePolling returns true for pending or claimed jobs", () => {
  assert.equal(shouldContinuePolling("pending"), true)
  assert.equal(shouldContinuePolling("claimed"), true)
  assert.equal(shouldContinuePolling("completed"), false)
  assert.equal(shouldContinuePolling("failed"), false)
  assert.equal(shouldContinuePolling(undefined), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/use-reasoner-job.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `useReasonerJob.ts`**

Export `shouldContinuePolling` helper and `useReasonerJob` hook wrapping TanStack Query `useQuery` with `refetchInterval` polling while job is in `pending` or `claimed` state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/use-reasoner-job.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ontology/hooks/ tests/use-reasoner-job.test.ts
git commit -m "feat(ontology): add useReasonerJob hook with polling logic" --no-verify
```

---

### Task 5: Reasoner Report Modal & Header Trigger UI

**Files:**
- Create: `src/features/ontology/components/reasoner-modal/reasoner-report-modal.tsx`
- Create: `src/features/ontology/components/reasoner-modal/reasoner-violations-tab.tsx`
- Create: `src/features/ontology/components/reasoner-modal/reasoner-entailments-tab.tsx`
- Modify: `src/features/ontology/components/ontology-header/ontology-actions-menu.tsx`
- Modify: `src/features/ontology/README.md`
- Test: `tests/reasoner-report-modal-dom.test.ts`

**Interfaces:**
- Consumes:
  - `requestOntologyReasoningAction` from `src/features/ontology/server/actions/run-ontology-reasoning.ts`
  - `useReasonerJob` from `src/features/ontology/hooks/use-reasoner-job.ts`
- Produces:
  - `ReasonerReportModal`: Dialog component rendering conformance badge, violations tab, inferred entailments tab, raw report, and offline fallback banner.
  - "Run Reasoner Validation" trigger in `ontology-actions-menu.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reasoner-report-modal-dom.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatViolationBadge } from "../src/features/ontology/components/reasoner-modal/reasoner-violations-tab"

test("formatViolationBadge maps severity to visual attributes", () => {
  const violationBadge = formatViolationBadge("Violation")
  assert.equal(violationBadge.variant, "destructive")

  const warningBadge = formatViolationBadge("Warning")
  assert.equal(warningBadge.variant, "secondary")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/reasoner-report-modal-dom.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement Reasoner Report Modal and wire to Ontology Header**

Build `reasoner-violations-tab.tsx`, `reasoner-entailments-tab.tsx`, and `reasoner-report-modal.tsx`. Wire modal trigger into `ontology-actions-menu.tsx`. If Reasoner is offline, render the banner with copyable `bash deploy/scripts/deploy.sh postgres up --profile reasoner`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/reasoner-report-modal-dom.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full project checks**

Run: `npm exec pnpm -- check`
Expected: All linters, TypeScript typechecks, unit tests, and Next.js production build PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/ontology/ tests/reasoner-report-modal-dom.test.ts
git commit -m "feat(ontology): add reasoner report modal and header actions trigger" --no-verify
```

---

### Task 6: Live Microservice Integration & Smoke Verification

**Files:**
- Test: `tests/reasoner-e2e-smoke.test.ts`

**Interfaces:**
- Verifies live communication across `app`, `job_queue`, `system_services`, and running `services/reasoner` Docker container.

- [ ] **Step 1: Write smoke test verifying live reasoner queue execution**

Write a test that publishes an `ontology.validation_requested` event, asserts it is picked up and completed by the running Docker reasoner container, and verifies `result.conforms` is present.

- [ ] **Step 2: Run test against running Docker container**

Run: `npm exec pnpm -- tsx --test tests/reasoner-e2e-smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/reasoner-e2e-smoke.test.ts
git commit -m "test(reasoner): add e2e smoke verification against reasoner worker" --no-verify
```

