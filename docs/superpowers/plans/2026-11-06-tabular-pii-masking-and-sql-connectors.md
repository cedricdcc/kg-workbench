# Tabular Privacy Masking Pipeline with User Controls & DuckDB Read-Only SQL Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a local, client-guided PII and sensitive column masking engine for AI schema synthesis, alongside DuckDB-powered read-only PostgreSQL and MySQL remote database connectors with interactive table discovery and persistent re-syncable dataset archiving.

**Architecture:** A deterministic TypeScript masking engine (`pii-masker.ts`) intercepts tabular sample rows before Gemini prompt construction, with user override controls exposed in `DatasetMappingModal`. DuckDB in `services/tabular` bundles native `postgres_scanner` and `mysql_scanner` extensions to discover remote tables and profile them directly over read-only connections via the transactional outbox (`job_queue`). Connection credentials are encrypted at rest with AES-256-GCM and scrubbed from event logs upon job completion.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, DuckDB (Python `duckdb`), FastAPI, PostgreSQL (Drizzle ORM), Gemini API.

**Spec:** [`docs/superpowers/specs/2026-11-06-tabular-pii-masking-and-sql-connectors-design.md`](file:///c:/Users/cedricd/Documents/Github/kg-workbench/docs/superpowers/specs/2026-11-06-tabular-pii-masking-and-sql-connectors-design.md)

## Global Constraints

- Use `pnpm` exclusively (`npm exec pnpm -- <command>` if pnpm is not on PATH).
- Use `"use server"` on all server action entry points in `src/features/tabular/server/actions/`.
- Strict type safety with zero unchecked `any`.
- All database passwords encrypted at rest using `encryptSecret` from `src/server/crypto.ts`.
- DuckDB `ATTACH` queries must enforce `READ_ONLY` mode.
- Zero raw PII in LLM prompts; column names remain clear for semantic mapping.
- Update `src/features/tabular/README.md` at completion.

## Review Focus

1. **False-positive PII flags on identifiers:** Domain codes (e.g. `order_id: 123-4567`) mistaken for phone numbers or SSNs must be cleanly unmaskable by the user, and unmasking must immediately restore raw sample values in the prompt.
2. **Database connection failure handling:** Unreachable hosts, invalid passwords, or connection timeouts must return descriptive user errors from the worker without crashing `daemon.py`.
3. **Empty table profiling:** Profiling a remote table with 0 rows must return rowCount 0, empty preview rows, and safe null-percentage calculations without dividing by zero.
4. **Outbox password scrubbing:** `domain_events.payload` must permanently scrub any `password` field upon job completion.
5. **SSL mode support:** PostgreSQL remote servers requiring SSL (`require` vs `prefer` vs `disable`) must be passed correctly into DuckDB's connection string without connection drops.

---

### Task 1: Deterministic PII & Sensitive Column Masker Engine

**Files:**
- Create: `src/features/tabular/server/services/pii-masker.ts`
- Test: `tests/tabular-pii-masker.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type PiiCategory = "email" | "phone" | "ip_address" | "credit_card" | "ssn" | "iban" | "secret" | "name" | "custom"
  export interface ColumnPrivacyConfig {
    columnName: string
    isMasked: boolean
    detectedCategory?: PiiCategory
    maskingStrategy: "token" | "redact" | "none"
  }
  export interface MaskingResult {
    sanitizedSampleRows: Record<string, unknown>[]
    sanitizedSampleValues: Record<string, Array<string | number | boolean>>
    tokenMap: Record<string, string>
    maskedColumnCount: number
  }
  export function autoDetectPii(columns: Array<{ name: string; sampleValues?: unknown[] }>, sampleRows: Record<string, unknown>[]): ColumnPrivacyConfig[]
  export function maskDatasetSamples(sampleRows: Record<string, unknown>[], configs: ColumnPrivacyConfig[], sampleValues?: Record<string, unknown[]>): MaskingResult
  export function sanitizeSynthesizedElements<T extends { synthesizedElements?: any }>(spec: T): T
  ```

- [ ] **Step 1: Write failing tests for PII auto-detection and masking**

Create `tests/tabular-pii-masker.test.ts` testing:
1. Auto-detection of emails, phone numbers, IPv4/IPv6, credit cards (with Luhn check), SSNs, IBANs, and secret/name column heuristics.
2. Value tokenization ensuring identical values produce the exact same token (`<EMAIL_1>`).
3. User overrides: unmasking an auto-detected column, force-masking a non-sensitive column, and using `redact` (`[REDACTED]`).
4. Sanitization of synthesized element descriptions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --test tests/tabular-pii-masker.test.ts`
Expected: FAIL ("Cannot find module .../pii-masker")

- [ ] **Step 3: Implement `src/features/tabular/server/services/pii-masker.ts`**

Implement regex patterns (email, phone, IP, credit card with Luhn, SSN, IBAN, secret tokens), column name heuristics, token dictionary replacement with session salt, and description sanitizer.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --test tests/tabular-pii-masker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/server/services/pii-masker.ts tests/tabular-pii-masker.test.ts
git commit -m "feat(tabular): add deterministic PII masking engine with user override support" --no-verify
```

---

### Task 2: Integrate Privacy Masking into AI Synthesis Action & Prompt

**Files:**
- Modify: `src/features/tabular/server/services/ai-mapping-prompt.ts`
- Modify: `src/features/tabular/server/actions/synthesize-mappings.ts`
- Test: `tests/tabular-mapping-prompt.test.ts`

**Interfaces:**
- Consumes: `autoDetectPii`, `maskDatasetSamples`, `sanitizeSynthesizedElements` from `pii-masker.ts`.
- Modifies `SynthesizeMappingsInput`:
  ```typescript
  export interface SynthesizeMappingsInput {
    ontologyId: string
    sourceName: string
    profile: {
      rowCount: number
      columnCount: number
      candidateKeys: string[][]
      columns: TabularColumnProfile[]
    }
    sampleRows: Record<string, unknown>[]
    privacyConfigs?: ColumnPrivacyConfig[]
  }
  ```
- Modifies `SynthesizeMappingsResponse`: includes `privacySummary: { maskedColumnCount: number }`.

- [ ] **Step 1: Write failing test for sanitized prompt construction**

In `tests/tabular-mapping-prompt.test.ts`:
Verify that when `privacyConfigs` are provided, `synthesizeOntologyMappingsAction` or `buildAiMappingPrompt` strictly contains masked placeholder tokens in `Sample Rows` and `sampleValues`, and that no raw PII strings appear in the prompt.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --test tests/tabular-mapping-prompt.test.ts`
Expected: FAIL

- [ ] **Step 3: Integrate PII masking into prompt builder and action**

In `src/features/tabular/server/actions/synthesize-mappings.ts`:
- Resolve or default `privacyConfigs`: if omitted, compute `autoDetectPii`.
- Call `maskDatasetSamples(input.sampleRows, privacyConfigs, sampleValuesByColumn)`.
- Pass sanitized sample rows and values to `buildAiMappingPrompt`.
- Apply `sanitizeSynthesizedElements(mappingSpec)` on Gemini output.
- Return `privacySummary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --test tests/tabular-mapping-prompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/server/services/ai-mapping-prompt.ts src/features/tabular/server/actions/synthesize-mappings.ts tests/tabular-mapping-prompt.test.ts
git commit -m "feat(tabular): wire PII masking and prompt sanitization into AI synthesis action" --no-verify
```

---

### Task 3: UI Privacy Shield & Column Masking Controls in Dataset Mapping Modal

**Files:**
- Create: `src/features/tabular/components/dataset-mapping-wizard/privacy-shield-badge.tsx`
- Create: `src/features/tabular/components/dataset-mapping-wizard/column-privacy-popover.tsx`
- Modify: `src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx`
- Test: `tests/dataset-mapping-privacy-ui.test.ts`

**Interfaces:**
- Produces:
  - `<PrivacyShieldBadge count={number} onReset={...} />`
  - `<ColumnPrivacyPopover config={ColumnPrivacyConfig} onChange={(updated) => ...} sampleValue={string} />`
- Modifies: `DatasetMappingModal` initializes privacy configs via `autoDetectPii`, renders privacy pill on each column in Step 1/2, and passes `privacyConfigs` state to `synthesizeOntologyMappingsAction`.

- [ ] **Step 1: Write component DOM test for PrivacyShieldBadge and ColumnPrivacyPopover**

Create `tests/dataset-mapping-privacy-ui.test.ts` checking:
1. `PrivacyShieldBadge` renders masked column count.
2. `ColumnPrivacyPopover` renders toggle and emits updated config on change.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --test tests/dataset-mapping-privacy-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement PrivacyShieldBadge, ColumnPrivacyPopover, and wire into DatasetMappingModal**

Implement shadcn popover with switches and radio options (`Token` vs `Redacted`), showing a real-time preview of the masked token. Render in `DatasetMappingModal` table rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --test tests/dataset-mapping-privacy-ui.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tabular/components/dataset-mapping-wizard/ tests/dataset-mapping-privacy-ui.test.ts
git commit -m "feat(tabular): add privacy shield badge and per-column masking popover in mapping modal" --no-verify
```

---

### Task 4: Dockerfile Extension Bundling & DuckDB Remote Table Discovery in Python Worker

**Files:**
- Modify: `services/tabular/Dockerfile`
- Modify: `services/tabular/src/tabular/profiler.py`
- Test: `services/tabular/tests/test_remote_db.py`

**Interfaces:**
- Produces:
  ```python
  def discover_remote_tables(
      db_type: str,
      host: str,
      port: int,
      database: str,
      user: str,
      password: str,
      ssl_mode: str = "prefer"
  ) -> List[Dict[str, Any]]:
      # Returns list of {"schema": str, "name": str, "type": "BASE TABLE" | "VIEW", "estimated_rows": Optional[int]}
  ```

- [ ] **Step 1: Write failing Python unit test for table discovery**

In `services/tabular/tests/test_remote_db.py`:
Test connecting to local postgres test instance (`db:5432`) and asserting discovered tables contain `ontology_documents` and `dataset_sources`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml exec -T tabular pytest services/tabular/tests/test_remote_db.py -k test_discover`
Expected: FAIL ("discover_remote_tables not defined")

- [ ] **Step 3: Bundle extensions in Dockerfile and implement `discover_remote_tables` in `profiler.py`**

- In `services/tabular/Dockerfile`: Add `RUN python3 -c "import duckdb; conn=duckdb.connect(); conn.execute('INSTALL postgres; INSTALL mysql;')"`
- In `services/tabular/src/tabular/profiler.py`: Implement `discover_remote_tables` using `LOAD postgres;` and `ATTACH '...' AS remote_db (TYPE POSTGRES, READ_ONLY); SELECT table_schema, table_name, table_type FROM remote_db.information_schema.tables; DETACH remote_db;`.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml exec -T tabular pytest services/tabular/tests/test_remote_db.py -k test_discover`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/tabular/Dockerfile services/tabular/src/tabular/profiler.py services/tabular/tests/test_remote_db.py
git commit -m "feat(tabular): bundle DuckDB scanners and implement remote database table discovery" --no-verify
```

---

### Task 5: DuckDB Remote Database Analytical Profiling in Python Worker & Daemon

**Files:**
- Modify: `services/tabular/src/tabular/profiler.py`
- Modify: `services/tabular/src/tabular/daemon.py`
- Test: `services/tabular/tests/test_remote_db.py`

**Interfaces:**
- Produces:
  ```python
  def profile_remote_database_table(
      db_type: str,
      host: str,
      port: int,
      database: str,
      user: str,
      password: str,
      table: str,
      schema: str = "public",
      ssl_mode: str = "prefer"
  ) -> Dict[str, Any]:
      # Returns standard TabularProfileResult dict
  ```
- Consumes events:
  - `tabular.db_discover_requested`
  - `tabular.db_profile_requested`

- [ ] **Step 1: Write failing Python unit test for remote table profiling**

In `services/tabular/tests/test_remote_db.py`:
Test profiling table `dataset_sources` via DuckDB postgres scanner, asserting returned column profiles, candidate keys, and preview rows match standard `TabularProfileResult`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml exec -T tabular pytest services/tabular/tests/test_remote_db.py -k test_profile_table`
Expected: FAIL

- [ ] **Step 3: Implement `profile_remote_database_table` and daemon event listeners**

In `profiler.py`:
Attach remote database with `READ_ONLY`, construct analytical query matching existing file profiler, calculate column stats, sample rows, and candidate keys, then detach.
In `daemon.py`:
Add handlers for `tabular.db_discover_requested` and `tabular.db_profile_requested`, decrypting credentials if passed encrypted or handling payload.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose --env-file deploy/.env.server -f deploy/compose.yaml -f deploy/providers/supabase.yaml exec -T tabular pytest services/tabular/tests/test_remote_db.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/tabular/src/tabular/profiler.py services/tabular/src/tabular/daemon.py services/tabular/tests/test_remote_db.py
git commit -m "feat(tabular): implement read-only remote table analytical profiling in DuckDB worker" --no-verify
```

---

### Task 6: Database Schema Migration & Server Actions for Discovery & Profiling

**Files:**
- Modify: `src/server/db/schema.ts` (add `connection_config`, `last_synced_at` to `datasetSources`)
- Create: `src/features/tabular/server/actions/remote-database.ts`
- Test: `tests/remote-database-actions.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface RemoteDbConnectionInput {
    dbType: "postgres" | "mysql"
    host: string
    port: number
    database: string
    user: string
    password: string
    sslMode?: "disable" | "prefer" | "require"
    ontologyId: string
  }
  export async function discoverRemoteTablesAction(input: RemoteDbConnectionInput): Promise<{ success: true; tables: Array<{ schema: string; name: string; type: string; estimatedRows?: number }> } | { success: false; error: string }>
  export async function profileRemoteTableAction(input: RemoteDbConnectionInput & { schema: string; table: string }): Promise<{ success: true; profile: TabularProfileResult } | { success: false; error: string }>
  export async function resyncDatabaseSourceAction(datasetSourceId: string): Promise<{ success: true; profile: TabularProfileResult } | { success: false; error: string }>
  ```

- [ ] **Step 1: Write failing test for remote database server actions**

Create `tests/remote-database-actions.test.ts` testing:
1. `discoverRemoteTablesAction` publishes event, awaits job, and scrubs password from outbox.
2. `profileRemoteTableAction` returns profile result with encrypted connection config.
3. `resyncDatabaseSourceAction` decrypts saved connection config and re-runs profiling.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --test tests/remote-database-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Update schema and implement server actions**

- In `src/server/db/schema.ts`: Add `connection_config: jsonb("connection_config")` and `last_synced_at: timestamp("last_synced_at", { withTimezone: true })` to `datasetSources`.
- In `src/features/tabular/server/actions/remote-database.ts`: Implement `discoverRemoteTablesAction`, `profileRemoteTableAction`, and `resyncDatabaseSourceAction`. Encrypt passwords using `encryptSecret` before event publish, and execute `UPDATE domain_events SET payload = payload - 'password'` upon job completion.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --test tests/remote-database-actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/features/tabular/server/actions/remote-database.ts tests/remote-database-actions.test.ts
git commit -m "feat(tabular): add schema columns and server actions for remote database discovery and re-sync" --no-verify
```

---

### Task 7: Database Connection UI & Re-Sync Integration in Workbench

**Files:**
- Modify: `src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx`
- Create: `src/features/tabular/components/tabular-profiler-modal/remote-database-tab.tsx`
- Modify: `src/features/tabular/components/dataset-archive-browser/dataset-archive-card.tsx`
- Modify: `src/features/tabular/README.md`
- Test: `tests/remote-database-ui.test.ts`

**Interfaces:**
- Produces:
  - `<RemoteDatabaseTab ontologyId={string} onProfileComplete={(result, connectionConfig) => ...} />`
- Modifies:
  - `TabularProfilerModal` adds source selector: `File Upload` vs `Remote Database`.
  - `DatasetArchiveCard` shows Database icon for SQL sources and renders `Re-sync` action button calling `resyncDatabaseSourceAction`.
  - Updates `src/features/tabular/README.md`.

- [ ] **Step 1: Write component DOM test for RemoteDatabaseTab and re-sync button**

Create `tests/remote-database-ui.test.ts` asserting:
1. `RemoteDatabaseTab` step 1 displays connection fields and "Discover Tables" button.
2. Step 2 renders searchable table combobox upon successful discovery.
3. `DatasetArchiveCard` renders "Re-sync" button when `connection_config` is present.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --test tests/remote-database-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement RemoteDatabaseTab, update TabularProfilerModal and DatasetArchiveCard**

Build two-step database explorer form using standard shadcn components (Card, Input, Button, Combobox, Badge). Wire up re-sync mutation with Sonner toast feedback and TanStack Query invalidation. Update `src/features/tabular/README.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --test tests/remote-database-ui.test.ts`
Expected: PASS

- [ ] **Step 5: Run full project verification suite**

Run: `pnpm check`
Expected: PASS (clean lint, typecheck, tests, and build)

- [ ] **Step 6: Commit**

```bash
git add src/features/tabular/components/ src/features/tabular/README.md tests/remote-database-ui.test.ts
git commit -m "feat(tabular): integrate two-step remote database UI, re-sync action, and update docs" --no-verify
```
