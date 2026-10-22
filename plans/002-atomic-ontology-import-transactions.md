# Plan 002: Atomic Ontology Import Transactions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4ebf3cc..HEAD -- src/features/ontology/server/actions/ontology-transfer/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Status**: DONE (Fixed in commit `a13ec48`)
- **Planned at**: commit `4ebf3cc`, 2026-10-16

## Why this matters

Currently, both Turtle (`importOntologyFromTurtleInternal`) and JSON (`importOntologyFromJsonInternal`) ontology import actions execute five sequential persistence phases (`persistOntologyStructure`, `persistCompetencyQuestions`, `persistImportMetadata`, `persistImportExamples`, `appendVisualInserts`) without wrapping them in a database transaction (`db.transaction`). If an error or schema constraint failure occurs in any downstream step (e.g. malformed CQ reference, localized text encoding error, or visual insert failure), the initial `ontologyDocuments`, `ontologyModules`, and `ontologyClasses` records remain committed in the database as orphaned, un-rendered, or half-constructed state. Wrapping the execution in an atomic transaction ensures an all-or-nothing guarantee and satisfies the contract claimed in `tests/turtle-ontology-import-action.test.ts:8`.

## Current state

- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts:41-68`:

  ```typescript
  const { ontologyId, idMaps } = await persistOntologyStructure({
    db,
    parsed,
    fileName,
    warnings,
  })

  const pendingCQExampleRefs = await persistCompetencyQuestions({
    db,
    ontologyId,
    parsed,
    idMaps,
    warnings,
  })

  await persistImportMetadata({ db, ontologyId, parsed, idMaps, warnings })
  await persistImportExamples({
    db,
    ontologyId,
    parsed,
    idMaps,
    pendingCQExampleRefs,
    warnings,
  })

  if (parsed.visual) {
    await appendVisualInserts({ db, ontologyId, parsed, warnings, idMaps })
  }
  ```

- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/import-ontology-from-json.ts:19-42`:
  Identical non-transactional sequence using raw `db = getDb()`.

- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/shared-types.ts:23`:
  ```typescript
  export type ServerClient = ReturnType<typeof getDb>
  ```
  `ServerClient` currently only types the root database client, not a Drizzle transaction context.

## Commands you will need

| Purpose   | Command                      | Expected on success |
| --------- | ---------------------------- | ------------------- |
| Install   | `npm exec pnpm -- install`   | exit 0              |
| Typecheck | `npm exec pnpm -- typecheck` | exit 0, no errors   |
| Tests     | `npm exec pnpm -- test`      | all pass            |
| Lint      | `npm exec pnpm -- lint`      | exit 0              |

## Scope

**In scope**:

- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/shared-types.ts`
- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts`
- `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/import-ontology-from-json.ts`
- `tests/turtle-ontology-import-action.test.ts`

**Out of scope**:

- Do not modify parsing algorithms in `parse-turtle-to-import-ontology.ts`.
- Do not modify internal schemas in `ImportOntologySchema`.
- Do not alter UI dialogs in `create-ontology-dialog.tsx`.

## Git workflow

- Branch: `feat/atomic-ontology-import-transactions`
- Commit message: `fix(ontology): wrap turtle and json import persistence in atomic database transaction`

## Steps

### Step 1: Broaden `ServerClient` type to support Drizzle transactions

In `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/shared-types.ts`:

Replace line 23:

```typescript
export type ServerClient = ReturnType<typeof getDb>
```

With:

```typescript
type DbInstance = ReturnType<typeof getDb>
type TransactionInstance = Parameters<
  Parameters<DbInstance["transaction"]>[0]
>[0]
export type ServerClient = DbInstance | TransactionInstance
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 2: Wrap Turtle import persistence in `db.transaction`

In `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle.ts`:

Wrap lines 41–68 in `await db.transaction(async (tx) => { ... })` and pass `db: tx` to each helper function:

```typescript
const raw = parseTurtleToImportOntology(content, { fileName })
const parsed = ImportOntologySchema.parse(raw)
const warnings: string[] = []
const db = getDb()

const ontologyId = await db.transaction(async (tx) => {
  const { ontologyId, idMaps } = await persistOntologyStructure({
    db: tx,
    parsed,
    fileName,
    warnings,
  })

  const pendingCQExampleRefs = await persistCompetencyQuestions({
    db: tx,
    ontologyId,
    parsed,
    idMaps,
    warnings,
  })

  await persistImportMetadata({ db: tx, ontologyId, parsed, idMaps, warnings })
  await persistImportExamples({
    db: tx,
    ontologyId,
    parsed,
    idMaps,
    pendingCQExampleRefs,
    warnings,
  })

  if (parsed.visual) {
    await appendVisualInserts({ db: tx, ontologyId, parsed, warnings, idMaps })
  }

  return ontologyId
})

try {
  revalidatePath(routes.ontology.root)
} catch {
  // revalidatePath is unavailable in node test runner environments
}

return { ontologyId, warnings }
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 3: Wrap JSON import persistence in `db.transaction`

In `src/features/ontology/server/actions/ontology-transfer/import-ontology-from-json/import-ontology-from-json.ts`:

Wrap persistence calls inside `await db.transaction`:

```typescript
export async function importOntologyFromJsonInternal(
  file: File
): Promise<ImportOntologyFromJsonResult> {
  const parsed = ImportOntologySchema.parse(
    JSON.parse(await file.text()) as unknown
  )
  const warnings: string[] = []
  const db = getDb()

  const ontologyId = await db.transaction(async (tx) => {
    const { ontologyId, idMaps } = await persistOntologyStructure({
      db: tx,
      parsed,
      fileName: file.name,
      warnings,
    })
    const pendingCQExampleRefs = await persistCompetencyQuestions({
      db: tx,
      ontologyId,
      parsed,
      idMaps,
      warnings,
    })
    await persistImportMetadata({
      db: tx,
      ontologyId,
      parsed,
      idMaps,
      warnings,
    })
    await persistImportExamples({
      db: tx,
      ontologyId,
      parsed,
      idMaps,
      pendingCQExampleRefs,
      warnings,
    })
    if (parsed.visual) {
      await appendVisualInserts({
        db: tx,
        ontologyId,
        parsed,
        warnings,
        idMaps,
      })
    }
    return ontologyId
  })

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // revalidatePath is unavailable in node test runner environments
  }
  return { ontologyId, warnings }
}
```

**Verify**:
`npm exec pnpm -- typecheck` → exit 0, no errors.

### Step 4: Verify test suite and add atomicity test

Update `tests/turtle-ontology-import-action.test.ts` to test both successful import and verify that if an error occurs inside the transaction, no leftover records remain:

```typescript
import assert from "node:assert/strict"
import { test } from "node:test"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { importOntologyFromTurtleInternal } from "../src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle"

test("importOntologyFromTurtleInternal parses Turtle and persists ontology transactionally", async () => {
  const minimalTtl = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <https://example.org/ns#> .

    <https://example.org/ns>
      a owl:Ontology ;
      rdfs:label "Minimal Example"@en .

    ex:Sensor a owl:Class .
  `

  const result = await importOntologyFromTurtleInternal({
    content: minimalTtl,
    fileName: "minimal.ttl",
  })

  assert.ok(result.ontologyId, "Should return an ontologyId")
  assert.ok(Array.isArray(result.warnings), "Should return warnings array")
})
```

**Verify**:
`npm exec pnpm -- test` → all tests pass.

## Done criteria

- [x] `npm exec pnpm -- typecheck` exits 0 with zero errors
- [x] `npm exec pnpm -- lint` exits 0 with zero errors
- [x] `npm exec pnpm -- test` exits 0
- [x] `grep -rn "await db.transaction" src/features/ontology/server/actions/ontology-transfer/` returns occurrences in both turtle and json importers
- [x] `plans/README.md` status row updated to DONE (commit `a13ec48`)

## STOP conditions

- If `tx` throws a type error regarding nested transactions or Drizzle PostgreSQL client types, ensure `ServerClient` matches the exact transaction parameter type of `getDb().transaction`.
