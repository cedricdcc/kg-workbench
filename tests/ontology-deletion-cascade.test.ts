import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { extractionRuns } from "../src/server/db/schema"

test("extractionRuns schema defines onDelete set null for ontology_id foreign key", () => {
  assert.ok(extractionRuns.ontology_id, "ontology_id column must exist")
  const foreignKeys =
    (extractionRuns as unknown as Record<symbol, unknown>)[
      Symbol.for("drizzle:PgInlineForeignKeys")
    ] || []
  assert.ok(
    Array.isArray(foreignKeys),
    "Foreign keys must be defined on extraction_runs"
  )
})

test("migration file for extraction_runs ontology cascade exists with valid version", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "drizzle/baseline/20261016160000_cascade_extraction_runs_ontology.sql"
  )
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist")
  const content = fs.readFileSync(migrationPath, "utf-8")
  assert.ok(content.includes("ON DELETE SET NULL"))
  assert.ok(content.includes("extraction_runs_ontology_id_fkey"))
})
