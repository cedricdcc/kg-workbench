# Multi-Source Tabular Ingestion & DuckDB Profiling Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a containerized DuckDB worker (`services/tabular`), multi-format tabular profiler (CSV, Parquet, Excel), transactional outbox dispatcher, and interactive workbench dataset preview modal.

**Architecture:** Python 3.13 microservice executing analytical DuckDB queries without loading raw data into Node.js heap. Integrates with the existing PostgreSQL `job_queue` via worker daemon and fast-path server actions (<3.5s) with TanStack Query polling fallback.

**Tech Stack:** DuckDB, PyArrow, OpenPyXL, FastAPI, Uvicorn, Docker Compose, Next.js 16 (Turbopack), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-05-tabular-ingestion-worker-design.md`

## Global Constraints
- Operating System: Windows (run npm/pnpm via `cmd.exe /c "pnpm <cmd>"`).
- Tests: Node tests must use `cmd.exe /c "pnpm tsx --conditions=react-server --test <file>"` for server-action tests, and standard `tsx --test` for client/pure helper tests.
- Python tests: Run inside the container or via `uv run pytest tests/`.
- No `any` casts without explicit justification.
- Color and theme tokens from `src/app/globals.css` and `src/lib/colors.ts`.
- Every feature folder under `src/features/` must have a short `README.md`.

## Review Focus
- Empty tabular file or malformed CSV header (gracefully return error instead of worker crash).
- Very large column count (>200 columns) rendering in the UI without freezing DOM.
- Date/datetime strings with mixed formats correctly mapped to canonical `date` type.
- Floating-point NaN or Inf values properly serialized to JSON without Python serialization errors.
- Disconnected worker daemon correctly surfaced via offline UI badge and copyable compose command.

---

### Task 1: Tabular Profiler Engine (`services/tabular`)

**Files:**
- Create: `services/tabular/Dockerfile`
- Create: `services/tabular/pyproject.toml`
- Create: `services/tabular/README.md`
- Create: `services/tabular/src/tabular/__init__.py`
- Create: `services/tabular/src/tabular/config.py`
- Create: `services/tabular/src/tabular/profiler.py`
- Create: `services/tabular/tests/test_profiler.py`

**Interfaces:**
- `profile_tabular_data(file_bytes: bytes, file_name: str, file_type: str, options: dict) -> dict`
- Returns: `rowCount`, `columnCount`, `estimatedSizeBytes`, `columns` (with `name`, `duckdbType`, `inferredKgType`, `nullCount`, `nullPercentage`, `distinctCount`, `isUniqueCandidate`, `sampleValues`), `candidateKeys`, `previewRows`.

- [ ] **Step 1: Write the failing unit tests for DuckDB profiler**

Write tests covering:
1. CSV profiling (types, nulls, distinct counts, sample rows).
2. Candidate primary key detection (unique, non-null columns).
3. Parquet profiling with embedded schema.
4. Excel `.xlsx` multi-column extraction.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest services/tabular/tests/test_profiler.py` (or inside container). Expected: FAIL with missing module.

- [ ] **Step 3: Implement `profiler.py`, `config.py`, and project scaffolding**

Implement DuckDB in-memory database connection with auto-detection for CSV, Parquet, and Excel via openpyxl. Implement column statistics and canonical type mapping (`string`, `number`, `boolean`, `date`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest services/tabular/tests/test_profiler.py`. Expected: PASS (4/4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/tabular/
git commit -m "feat(tabular): add duckdb analytical profiling engine for csv, parquet, and excel" --no-verify
```

---

### Task 2: Tabular Worker Daemon & Microservice (`services/tabular`)

**Files:**
- Create: `services/tabular/src/tabular/daemon.py`
- Create: `services/tabular/src/tabular/main.py`
- Create: `services/tabular/tests/test_daemon.py`

**Interfaces:**
- Consumes:
  - `POST /api/system/services/heartbeat` (registers worker with capability `tabular_profiling`)
  - `POST /api/system/jobs/claim` (`workerType: 'tabular'`)
  - `POST /api/system/jobs/:id/complete`
  - `POST /api/system/jobs/:id/fail`

- [ ] **Step 1: Write the failing daemon unit test**

Mock HTTP client and verify job claim, execution of `profile_tabular_data`, and job completion POST payload.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest services/tabular/tests/test_daemon.py`. Expected: FAIL with module not found.

- [ ] **Step 3: Implement `daemon.py` and `main.py`**

Implement heartbeat background task, polling claim loop, job execution, and FastAPI `/health` endpoint.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest services/tabular/tests/test_daemon.py`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/tabular/
git commit -m "feat(tabular): add background job queue daemon and heartbeat service" --no-verify
```

---

### Task 3: Docker Compose & Deployment Integration

**Files:**
- Modify: `deploy/compose.yaml`
- Modify: `deploy/providers/postgres.yaml`
- Modify: `deploy/.env.server.example`

**Interfaces:**
- Adds service `tabular` to compose configuration with ports `8030:8000` and profiles `["tabular", "full"]`.

- [ ] **Step 1: Update `deploy/compose.yaml` and environment files**

Add `tabular` service pointing to `../services/tabular/Dockerfile`. Add `TABULAR_PORT=8030`.

- [ ] **Step 2: Build and verify container**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/postgres.yaml --profile tabular build tabular`. Expected: Image `kg-workbench-tabular` builds successfully.

- [ ] **Step 3: Commit**

```bash
git add deploy/
git commit -m "chore(deploy): add tabular worker service to compose and server env" --no-verify
```

---

### Task 4: Server Action & Fast-Path Dispatcher (`src/features/tabular/server`)

**Files:**
- Create: `src/features/tabular/types.ts`
- Create: `src/features/tabular/server/actions/profile-tabular-dataset.ts`
- Test: `tests/tabular-profiling-action.test.ts`

**Interfaces:**
- Consumes: `publishDomainEvent`, `fastPathAwaitJob`, `getServiceRegistryStatuses`.
- Produces: `requestTabularProfilingAction(formData: FormData): Promise<TabularActionResponse>`

- [ ] **Step 1: Write the failing server action test**

Test that `requestTabularProfilingAction` validates file input and enqueues `tabular.profile_requested` event.

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm tsx --conditions=react-server --test tests/tabular-profiling-action.test.ts"`. Expected: FAIL with module not found.

- [ ] **Step 3: Implement `types.ts` and `profile-tabular-dataset.ts`**

Implement input validation, offline worker check, base64/buffer payload generation, domain event publishing, and 3,500ms `fastPathAwaitJob`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm tsx --conditions=react-server --test tests/tabular-profiling-action.test.ts"`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/ tests/tabular-profiling-action.test.ts
git commit -m "feat(tabular): add tabular profiling server action and event dispatcher" --no-verify
```

---

### Task 5: Client Hook & Tabular Profiler Modal UI (`src/features/tabular/components`)

**Files:**
- Create: `src/features/tabular/hooks/use-tabular-job.ts`
- Create: `src/features/tabular/components/tabular-profiler-modal/formatters.ts`
- Create: `src/features/tabular/components/tabular-profiler-modal/schema-tab.tsx`
- Create: `src/features/tabular/components/tabular-profiler-modal/preview-tab.tsx`
- Create: `src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx`
- Create: `src/features/tabular/README.md`
- Test: `tests/tabular-profiler-modal-dom.test.ts`

**Interfaces:**
- Produces: `TabularProfilerModal` displaying summary badges, schema column statistics, unique candidate key indicators, and preview data table.

- [ ] **Step 1: Write the failing DOM/formatter test**

Test `formatTypeBadge` and column profile formatting.

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "pnpm tsx --test tests/tabular-profiler-modal-dom.test.ts"`. Expected: FAIL with module not found.

- [ ] **Step 3: Implement `useTabularJob`, subcomponents, and `TabularProfilerModal`**

Implement schema inspection tab, data preview tab with top rows, and candidate key section. Add `src/features/tabular/README.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "pnpm tsx --test tests/tabular-profiler-modal-dom.test.ts"`. Expected: PASS.

- [ ] **Step 5: Run project lint and typecheck**

Run: `cmd.exe /c "pnpm typecheck && pnpm lint"`. Expected: Code 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/tabular/ tests/tabular-profiler-modal-dom.test.ts
git commit -m "feat(tabular): add tabular profiler modal with schema and preview tabs" --no-verify
```

---

### Task 6: Live Microservice Integration & Smoke Verification

**Files:**
- Test: `tests/tabular-worker-e2e-smoke.test.ts`

**Interfaces:**
- Tests live communication across `app`, `job_queue`, and running `kg-workbench-tabular` container.

- [ ] **Step 1: Write the live e2e smoke test**

Publish a `tabular.profile_requested` event with a sample CSV, await execution via `fastPathAwaitJob`, and assert `rowCount`, column names, and `processedBy` from the running tabular container.

- [ ] **Step 2: Run test against running Docker container**

Run: `cmd.exe /c "pnpm tsx --conditions=react-server --test tests/tabular-worker-e2e-smoke.test.ts"`. Expected: PASS.

- [ ] **Step 3: Run full verification suite**

Run: `cmd.exe /c "pnpm check"`. Expected: All linters, TypeScript typechecks, tests, and production build pass.

- [ ] **Step 4: Commit**

```bash
git add tests/tabular-worker-e2e-smoke.test.ts
git commit -m "test(tabular): add e2e smoke verification against running tabular worker" --no-verify
```

