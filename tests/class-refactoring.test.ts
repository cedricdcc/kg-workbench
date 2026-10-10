import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ReparentClassInputSchema,
  MergeClassesInputSchema,
} from "../src/features/ontology/schemas/class-refactoring"

test("ReparentClassInputSchema and MergeClassesInputSchema validate correctly", () => {
  const reparent = ReparentClassInputSchema.parse({
    ontologyId: "11111111-1111-4111-8111-111111111111",
    classId: "22222222-2222-4222-8222-222222222222",
    targetParentClassId: "33333333-3333-4333-8333-333333333333",
  })
  assert.equal(reparent.classId, "22222222-2222-4222-8222-222222222222")

  const merge = MergeClassesInputSchema.parse({
    ontologyId: "11111111-1111-4111-8111-111111111111",
    sourceClassId: "22222222-2222-4222-8222-222222222222",
    targetClassId: "44444444-4444-4444-8444-444444444444",
  })
  assert.equal(merge.targetClassId, "44444444-4444-4444-8444-444444444444")
})
