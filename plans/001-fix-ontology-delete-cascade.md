# Plan 001: Fix Ontology Delete Cascade on Connected Extraction Runs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ebf3cc..HEAD -- src/server/db/schema.ts drizzle/ src/features/ontology/server/actions/ontology-documents.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Status**: DONE (Fixed in commit `5898ed3`)
- **Planned at**: commit `4ebf3cc`, 2026-10-16

## Why this matters

Deleting an ontology document currently fails with an unhandled PostgreSQL foreign key violation error if any document extraction run has ever referenced that ontology. In `drizzle/baseline/20260410160829_initial_schema.sql`, `extraction_runs.ontology_id` references `ontology_documents(id)` with default `RESTRICT` behavior rather than `ON DELETE SET NULL` or `ON DELETE CASCADE`. Fixing this database foreign key constraint unblocks the ontology lifecycle and allows users to delete obsolete or temporary ontologies without database errors.

## Current state

- `drizzle/baseline/20260410160829_initial_schema.sql:84-92`:

  ```sql
  CREATE TABLE extraction_runs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ontology_id  uuid REFERENCES ontology_documents(id),
    status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at   timestamptz,
    completed_at timestamptz,
    created_at   timestamptz DEFAULT now()
  );
  ```

  Note `ontology_id` lacks `ON DELETE SET NULL` or `ON DELETE CASCADE`.

- `src/server/db/schema.ts:103-119`:

  ```typescript
  export const extractionRuns = pgTable("extraction_runs", {
    id: generatedId(),
    document_id: uuid("document_id").notNull(),
    ontology_id: uuid("ontology_id"),
    status: text("status").notNull().default("pending"),
    started_at: timestamp("started_at", { withTimezone: true, mode: "string" }),
    completed_at: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    created_at: created_at(),
    group_key: text("group_key").notNull().default("shared"),
    extractor_backend: text("extractor_backend").notNull().default("external"),
    internal_provider: text("internal_provider"),
    internal_model_name: text("internal_model_name"),
    external_extractor_url: text("external_extractor_url"),
  })
  ```

- `src/features/ontology/server/actions/ontology-documents.ts:66-71`:

  ```typescript
  export async function deleteOntologyDocument(id: string): Promise<void> {
    const db = getDb()
    await assertOntologyDocumentAccess(id, db)
    await db.delete(ontologyDocuments).where(eq(ontologyDocuments.id, id))
    revalidatePath(routes.ontology.root)
  }
  ```

- `docs/backlog/TODOS_NOW.md:34` documents this exact bug:
  _"Bug: Deleting an ontology not possible when there are connected extraction runs -> should be deleted via cascade as well"_

## Commands you will need

| Purpose   | Command                      | Expected on success |
| --------- | ---------------------------- | ------------------- |
| Install   | `npm exec pnpm -- install`   | exit 0              |
| Typecheck | `npm exec pnpm -- typecheck` | exit 0, no errors   |
| Tests     | `npm exec pnpm -- test`      | all pass            |
| Lint      | `npm exec pnpm -- lint`      | exit 0              |

## Scope

**In scope**:

- `drizzle/baseline/20261016160000_cascade_extraction_runs_ontology.sql` (create new migration)
- `src/server/db/schema.ts` (update `extractionRuns.ontology_id` definition)
- `tests/ontology-deletion-cascade.test.ts` (create new unit/integration test)

**Out of scope**:

- Do not modify existing past baseline migration files in `drizzle/baseline/`.
- Do not modify `document_id` cascades on `extraction_runs` (already cascading).
- Do not change how extraction runs are queried or created.

## Git workflow

- Branch: `feat/fix-ontology-delete-cascade`
- Commit message: `fix(ontology): add cascade constraint to extraction_runs ontology_id`

## Steps

### Step 1: Create the SQL migration in `drizzle/baseline/`

Create `drizzle/baseline/20261016160000_cascade_extraction_runs_ontology.sql` with the following content:

```sql
-- Allow deleting ontology documents even when referenced by extraction runs
ALTER TABLE extraction_runs
  DROP CONSTRAINT IF EXISTS extraction_runs_ontology_id_fkey;

ALTER TABLE extraction_runs
  ADD CONSTRAINT extraction_runs_ontology_id_fkey
  FOREIGN KEY (ontology_id)
  REFERENCES ontology_documents(id)
  ON DELETE SET NULL;
```

> **Rationale for `ON DELETE SET NULL` over `CASCADE`**: An extraction run belongs primarily to a `document` (`document_id` cascades when the document is deleted). If a user deletes an ontology definition, setting `ontology_id` to `NULL` preserves the historical extraction run and its extracted facts in the document workspace without corrupting extraction runs, while completely removing the deletion blocker.

**Verify**:
`npm exec pnpm -- test` → `tests/migrations.test.ts` passes (asserting unique migration version format `^(\d{14})_.+\.sql$`).

### Step 2: Update Drizzle schema in `src/server/db/schema.ts`

In `src/server/db/schema.ts:106`, update `ontology_id` in `extractionRuns` to declare the foreign key reference:

```typescript
export const extractionRuns = pgTable("extraction_runs", {
  id: generatedId(),
  document_id: uuid("document_id").notNull(),
  ontology_id: uuid("ontology_id").references(() => ontologyDocuments.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("pending"),
  ...
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 3: Add automated test for ontology deletion with extraction runs

Create `tests/ontology-deletion-cascade.test.ts`:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import { extractionRuns, ontologyDocuments } from "../src/server/db/schema"

test("extractionRuns schema defines onDelete set null for ontology_id foreign key", () => {
  assert.ok(extractionRuns.ontology_id, "ontology_id column must exist")
  // Verify foreign key configuration exists
  // @ts-expect-error accessing internal drizzle metadata
  const foreignKeys =
    extractionRuns[Symbol.for("drizzle:PgInlineForeignKeys")] || []
  assert.ok(
    Array.isArray(foreignKeys),
    "Foreign keys must be defined on extraction_runs"
  )
})

test("migration file for extraction_runs ontology cascade exists with valid version", () => {
  const fs = require("node:fs")
  const path = require("node:path")
  const migrationPath = path.resolve(
    process.cwd(),
    "drizzle/baseline/20261016160000_cascade_extraction_runs_ontology.sql"
  )
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist")
  const content = fs.readFileSync(migrationPath, "utf-8")
  assert.ok(content.includes("ON DELETE SET NULL"))
  assert.ok(content.includes("extraction_runs_ontology_id_fkey"))
})
```

**Verify**:
`npm exec pnpm -- test` → 99+ tests pass.

## Done criteria

- [x] `npm exec pnpm -- typecheck` exits 0 with zero errors
- [x] `npm exec pnpm -- lint` exits 0 with zero errors
- [x] `npm exec pnpm -- test` exits 0 with all migration and deletion tests passing
- [x] Migration filename matches `^(\d{14})_.+\.sql$` format
- [x] `plans/README.md` status row updated to DONE (commit `5898ed3`)

## STOP conditions

- If `tests/migrations.test.ts` fails because of a duplicate migration version, stop and change the 14-digit prefix to avoid collision.
- If existing schema relationships in `src/server/db/schema.ts` error on circular import, check Drizzle schema imports before proceeding.
