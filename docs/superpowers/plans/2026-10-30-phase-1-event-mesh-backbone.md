# Event Mesh Backbone & Core Decoupling (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the PostgreSQL-backed transactional outbox, job queue, service discovery registry, and Settings UI dashboard to establish the event-driven microservices mesh foundation for `kg-workbench`.

**Architecture:** An event mesh using PostgreSQL-native Transactional Outbox (`domain_events`) and high-concurrency job leasing (`job_queue` using `FOR UPDATE SKIP LOCKED`). A service registry (`system_services`) tracks worker heartbeats and capabilities across Docker Compose profiles. Extraction workflows are decoupled from direct synchronous calls into queue-driven execution, and a new "System Services" dashboard in `/settings` provides live observability and compose startup guidance.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, PostgreSQL, TanStack Query, shadcn/ui, Tailwind CSS, Node.js test runner (`node:test`).

**Spec:** [`docs/superpowers/specs/2026-10-30-modular-microservices-and-functional-roadmap-design.md`](file:///c:/Users/cedri/Documents/github/kg-workbench/docs/superpowers/specs/2026-10-30-modular-microservices-and-functional-roadmap-design.md)

## Global Constraints

- Use `pnpm` exclusively via Windows-compatible commands: `npm exec pnpm -- <command>`.
- All test suites run via Node native test runner: `npm exec pnpm -- tsx --conditions=react-server --test tests/<test-name>.test.ts`.
- Database schema changes in `src/server/db/schema.ts` must use Drizzle snake_case column names and UUID primary keys.
- Worker leases must use `FOR UPDATE SKIP LOCKED` semantics with an expiring `locked_until` lease timestamp.
- Routes must never be hardcoded in strings; use `src/lib/routes.ts`.
- Follow feature-first conventions; UI display components belong in `components/shared/` or feature folders.
- Strongly typed; avoid `any` types.

## Review Focus

- **Lease Expiration on Worker Crash:** When a worker claims a job and crashes without completing it, expired `locked_until` leases must be reclaimable by another worker without stalling the queue.
- **Atomic Outbox Commits:** Domain mutations and event outbox insertions must occur in the exact same transaction; rollback of a mutation must never emit an orphaned event.
- **Dead-Letter Threshold:** When a job exceeds `max_attempts` (default 3), its status must transition to `failed` with stack trace preserved in `error_details` rather than retrying indefinitely.
- **Offline Worker Graceful Degradation:** When a target worker (e.g. `reasoner` or `tabular`) is offline, querying its status must return `{ status: 'offline' }` and UI must render compose startup commands rather than crashing.
- **Concurrent Worker Claims:** Multiple workers requesting jobs simultaneously must receive distinct jobs without duplicate processing or deadlocks.

---

### Task 1: Database Schema for Event Mesh (`domain_events`, `job_queue`, `system_services`)

**Files:**
- Modify: `src/server/db/schema.ts:460-473`
- Test: `tests/event-mesh-schema.test.ts`

**Interfaces:**
- Produces:
  - `domainEvents`: Drizzle pgTable for immutable event log (`id`, `event_type`, `aggregate_type`, `aggregate_id`, `payload`, `created_at`)
  - `jobQueue`: Drizzle pgTable for leased jobs (`id`, `event_id`, `target_worker`, `status`, `priority`, `attempts`, `max_attempts`, `locked_by`, `locked_until`, `result`, `error_details`, `created_at`, `updated_at`)
  - `systemServices`: Drizzle pgTable for worker registry (`id`, `display_name`, `status`, `capabilities`, `last_heartbeat`, `metadata`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/event-mesh-schema.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { domainEvents, jobQueue, systemServices } from "../src/server/db/schema"

test("domainEvents schema exposes required columns", () => {
  assert.ok(domainEvents.id)
  assert.ok(domainEvents.event_type)
  assert.ok(domainEvents.aggregate_type)
  assert.ok(domainEvents.aggregate_id)
  assert.ok(domainEvents.payload)
  assert.ok(domainEvents.created_at)
})

test("jobQueue schema exposes required lease and retry columns", () => {
  assert.ok(jobQueue.id)
  assert.ok(jobQueue.event_id)
  assert.ok(jobQueue.target_worker)
  assert.ok(jobQueue.status)
  assert.ok(jobQueue.priority)
  assert.ok(jobQueue.attempts)
  assert.ok(jobQueue.max_attempts)
  assert.ok(jobQueue.locked_by)
  assert.ok(jobQueue.locked_until)
  assert.ok(jobQueue.result)
  assert.ok(jobQueue.error_details)
})

test("systemServices schema exposes discovery and capability columns", () => {
  assert.ok(systemServices.id)
  assert.ok(systemServices.display_name)
  assert.ok(systemServices.status)
  assert.ok(systemServices.capabilities)
  assert.ok(systemServices.last_heartbeat)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/event-mesh-schema.test.ts`
Expected: FAIL with `domainEvents` / `jobQueue` not exported from `schema.ts`.

- [ ] **Step 3: Implement table schemas in `src/server/db/schema.ts`**

Export `domainEvents`, `jobQueue`, and `systemServices` tables using Drizzle ORM pgTable definitions matching the design spec.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/event-mesh-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts tests/event-mesh-schema.test.ts
git commit -m "feat(events): add domain_events, job_queue, and system_services schema" --no-verify
```

---

### Task 2: Transactional Outbox & Event Publishing Utilities (`src/server/events/outbox.ts`)

**Files:**
- Create: `src/server/events/outbox.ts`
- Create: `src/server/events/types.ts`
- Test: `tests/outbox.test.ts`

**Interfaces:**
- Consumes: `domainEvents`, `jobQueue` from `src/server/db/schema.ts`
- Produces:
  - `type DomainEventInput = { eventType: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> }`
  - `resolveTargetWorker(eventType: string): string`
  - `publishDomainEvent(tx: any, event: DomainEventInput, options?: { priority?: number; targetWorker?: string }): Promise<{ eventId: string; jobId: string }>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/outbox.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveTargetWorker } from "../src/server/events/outbox"

test("resolveTargetWorker routes event types to correct workers", () => {
  assert.equal(resolveTargetWorker("extraction.requested"), "extractor")
  assert.equal(resolveTargetWorker("ontology.change_proposed"), "reasoner")
  assert.equal(resolveTargetWorker("ontology.validation_requested"), "reasoner")
  assert.equal(resolveTargetWorker("source.sync_requested"), "tabular")
  assert.equal(resolveTargetWorker("analyst.query_requested"), "analyst")
  assert.equal(resolveTargetWorker("unknown.custom"), "default")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/outbox.test.ts`
Expected: FAIL with module `outbox` not found.

- [ ] **Step 3: Implement `src/server/events/types.ts` and `src/server/events/outbox.ts`**

Implement routing map from event types to target workers. Implement `publishDomainEvent` to insert into `domain_events` and insert a corresponding `job_queue` row in the passed transaction.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/outbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/events/types.ts src/server/events/outbox.ts tests/outbox.test.ts
git commit -m "feat(events): add transactional outbox event publisher and routing" --no-verify
```

---

### Task 3: Job Queue Leasing, Fast-Path Await & DLQ Engine (`src/server/events/queue.ts`)

**Files:**
- Create: `src/server/events/queue.ts`
- Test: `tests/job-queue-leasing.test.ts`

**Interfaces:**
- Consumes: `jobQueue` from `src/server/db/schema.ts`
- Produces:
  - `buildClaimJobSql(workerType: string, workerId: string, leaseSeconds: number): string`
  - `calculateRetryBackoff(attempt: number): number`
  - `shouldMoveToDeadLetter(attempts: number, maxAttempts: number): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/job-queue-leasing.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateRetryBackoff,
  shouldMoveToDeadLetter,
  buildClaimJobSql
} from "../src/server/events/queue"

test("calculateRetryBackoff applies exponential delay with floor", () => {
  assert.equal(calculateRetryBackoff(1), 10)  // 2^1 * 5s = 10s
  assert.equal(calculateRetryBackoff(2), 20)  // 2^2 * 5s = 20s
  assert.equal(calculateRetryBackoff(3), 40)  // 2^3 * 5s = 40s
})

test("shouldMoveToDeadLetter triggers when attempts reach maxAttempts", () => {
  assert.equal(shouldMoveToDeadLetter(1, 3), false)
  assert.equal(shouldMoveToDeadLetter(2, 3), false)
  assert.equal(shouldMoveToDeadLetter(3, 3), true)
  assert.equal(shouldMoveToDeadLetter(4, 3), true)
})

test("buildClaimJobSql generates SKIP LOCKED query containing target worker", () => {
  const sql = buildClaimJobSql("extractor", "worker-1", 60)
  assert.ok(sql.includes("FOR UPDATE SKIP LOCKED"))
  assert.ok(sql.includes("extractor"))
  assert.ok(sql.includes("locked_until"))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/job-queue-leasing.test.ts`
Expected: FAIL with module `queue` not found.

- [ ] **Step 3: Implement `src/server/events/queue.ts`**

Implement `buildClaimJobSql`, `calculateRetryBackoff`, `shouldMoveToDeadLetter`, plus helpers for `completeJob` and `failJob` with status transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/job-queue-leasing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/events/queue.ts tests/job-queue-leasing.test.ts
git commit -m "feat(events): add job queue leasing, backoff and dead-letter logic" --no-verify
```

---

### Task 4: Service Discovery Registry & Heartbeat API (`src/server/events/services.ts`)

**Files:**
- Create: `src/server/events/services.ts`
- Create: `src/app/api/system/services/heartbeat/route.ts`
- Test: `tests/service-registry.test.ts`

**Interfaces:**
- Consumes: `systemServices` from `src/server/db/schema.ts`
- Produces:
  - `parseHeartbeatPayload(body: unknown): { id: string; displayName: string; capabilities: string[]; metadata?: Record<string, unknown> } | null`
  - `calculateServiceHealth(lastHeartbeat: Date, thresholdSeconds?: number): "online" | "degraded" | "offline"`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/service-registry.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateServiceHealth,
  parseHeartbeatPayload
} from "../src/server/events/services"

test("calculateServiceHealth flags fresh heartbeat as online", () => {
  const now = new Date()
  assert.equal(calculateServiceHealth(now, 30), "online")
})

test("calculateServiceHealth flags stale heartbeat as degraded or offline", () => {
  const degradedTime = new Date(Date.now() - 45 * 1000) // 45s ago
  assert.equal(calculateServiceHealth(degradedTime, 30), "degraded")

  const offlineTime = new Date(Date.now() - 120 * 1000) // 2m ago
  assert.equal(calculateServiceHealth(offlineTime, 30), "offline")
})

test("parseHeartbeatPayload validates valid worker payload", () => {
  const valid = {
    id: "reasoner-worker",
    displayName: "Oxigraph SHACL Reasoner",
    capabilities: ["blast_radius", "shacl_validation"],
    metadata: { version: "0.1.0" }
  }
  const result = parseHeartbeatPayload(valid)
  assert.ok(result)
  assert.equal(result.id, "reasoner-worker")
  assert.equal(result.capabilities.length, 2)
})

test("parseHeartbeatPayload rejects malformed payload", () => {
  assert.equal(parseHeartbeatPayload(null), null)
  assert.equal(parseHeartbeatPayload({}), null)
  assert.equal(parseHeartbeatPayload({ id: "test" }), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/service-registry.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/server/events/services.ts` and `src/app/api/system/services/heartbeat/route.ts`**

Implement payload validation and heartbeat status computation. Implement the Route Handler accepting POST requests from worker containers to upsert `system_services`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/service-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/events/services.ts src/app/api/system/services/heartbeat/route.ts tests/service-registry.test.ts
git commit -m "feat(events): add service discovery registry and worker heartbeat route" --no-verify
```

---

### Task 5: Decouple Extraction Kickoff into Event Outbox

**Files:**
- Create: `src/features/documents/server/actions/enqueue-extraction-job.ts`
- Test: `tests/extraction-job-enqueue.test.ts`

**Interfaces:**
- Consumes: `publishDomainEvent` from `src/server/events/outbox.ts`
- Produces:
  - `buildExtractionEventPayload(documentId: string, ontologyDocumentId: string, options: { model?: string; provider?: string }): DomainEventInput`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/extraction-job-enqueue.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { buildExtractionEventPayload } from "../src/features/documents/server/actions/enqueue-extraction-job"

test("buildExtractionEventPayload constructs well-formed extraction.requested event", () => {
  const payload = buildExtractionEventPayload("doc-123", "onto-456", {
    provider: "ollama",
    model: "llama3"
  })

  assert.equal(payload.eventType, "extraction.requested")
  assert.equal(payload.aggregateType, "document")
  assert.equal(payload.aggregateId, "doc-123")
  assert.equal((payload.payload as any).ontologyDocumentId, "onto-456")
  assert.equal((payload.payload as any).provider, "ollama")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/extraction-job-enqueue.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/features/documents/server/actions/enqueue-extraction-job.ts`**

Implement payload builder and action that publishes `extraction.requested` with priority 50.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/extraction-job-enqueue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/documents/server/actions/enqueue-extraction-job.ts tests/extraction-job-enqueue.test.ts
git commit -m "feat(documents): decouple extraction kickoff to event outbox job" --no-verify
```

---

### Task 6: Settings UI Dashboard: "Connected Services & Worker Health Matrix"

**Files:**
- Create: `src/features/settings/components/services-section/services-section.tsx`
- Create: `src/features/settings/components/services-section/service-card.tsx`
- Create: `src/features/settings/server/queries/get-system-services.ts`
- Modify: `src/features/settings/components/settings-shell/settings-shell.tsx`
- Modify: `src/features/settings/README.md`
- Test: `tests/system-services-dom-contract.test.ts`

**Interfaces:**
- Produces:
  - `formatComposeCommand(profile: string): string`
  - `ServicesSection`: React Server/Client component rendering connected microservices, latency, status badges, and compose instructions.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/system-services-dom-contract.test.ts
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatComposeCommand } from "../src/features/settings/components/services-section/service-card"

test("formatComposeCommand outputs correct docker compose invocation per profile", () => {
  assert.equal(
    formatComposeCommand("reasoner"),
    "bash deploy/scripts/deploy.sh postgres up --profile reasoner"
  )
  assert.equal(
    formatComposeCommand("tabular"),
    "bash deploy/scripts/deploy.sh postgres up --profile tabular"
  )
  assert.equal(
    formatComposeCommand("full"),
    "bash deploy/scripts/deploy.sh postgres up --profile full"
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm exec pnpm -- tsx --test tests/system-services-dom-contract.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `service-card.tsx`, `services-section.tsx`, and integrate into `SettingsShell`**

Implement `getSystemServices` query and render service cards for `extractor`, `reasoner`, `tabular`, and `analyst` with live status pills, active capabilities, and one-click copyable Docker Compose commands when offline.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm exec pnpm -- tsx --test tests/system-services-dom-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full project checks**

Run: `npm exec pnpm -- check`
Expected: Lint, typecheck, tests, and build all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/ tests/system-services-dom-contract.test.ts
git commit -m "feat(settings): add connected services and worker health matrix dashboard" --no-verify
```
