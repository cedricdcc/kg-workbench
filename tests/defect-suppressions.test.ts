import assert from "node:assert/strict"
import { test } from "node:test"
import { ontologyDefectSuppressions } from "../src/server/db/schema"
import { getDefectSuppressions } from "../src/features/ontology/server/queries/defect-suppressions"
import { toggleDefectSuppression } from "../src/features/ontology/server/actions/defect-suppressions"

test("ontologyDefectSuppressions table schema exposes expected columns", () => {
  assert.ok(ontologyDefectSuppressions, "Table must be defined")
  assert.ok(ontologyDefectSuppressions.id, "Table must have id column")
  assert.ok(ontologyDefectSuppressions.ontology_id, "Table must have ontology_id column")
  assert.ok(ontologyDefectSuppressions.defect_id, "Table must have defect_id column")
  assert.ok(ontologyDefectSuppressions.created_at, "Table must have created_at column")
})

test("getDefectSuppressions rejects empty or whitespace ontologyId", async () => {
  await assert.rejects(
    async () => {
      await getDefectSuppressions("   ")
    },
    /Ontology ID is required/
  )
})

test("toggleDefectSuppression rejects missing parameters", async () => {
  await assert.rejects(
    async () => {
      await toggleDefectSuppression("", "defect-1", true)
    },
    /Ontology ID is required/
  )

  await assert.rejects(
    async () => {
      await toggleDefectSuppression("ont-1", "", true)
    },
    /Defect ID is required/
  )
})
