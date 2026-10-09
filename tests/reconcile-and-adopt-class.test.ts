import assert from "node:assert/strict"
import { test } from "node:test"
import {
  ReconcileAndAdoptClassInputSchema,
  type ReconcileAndAdoptClassInput,
} from "../src/features/ontology/schemas/reconciliation"

test("ReconcileAndAdoptClassInputSchema validates valid input", () => {
  const valid: ReconcileAndAdoptClassInput = {
    ontologyId: "11111111-1111-4111-8111-111111111111",
    classId: "22222222-2222-4222-8222-222222222222",
    standardTerm: {
      curie: "sosa:Observation",
      label: "Observation",
      description: "Act of carrying out an observation",
      iri: "http://www.w3.org/ns/sosa/Observation",
    },
    retainedAttributeIds: ["33333333-3333-4333-8333-333333333333"],
    relationDecisions: [
      {
        relationId: "44444444-4444-4444-8444-444444444444",
        action: "remap",
        remappedName: "sosa:observedProperty",
      },
      {
        relationId: "55555555-5555-4555-8555-555555555555",
        action: "delete",
      },
      {
        relationId: "66666666-6666-4666-8666-666666666666",
        action: "keep",
      },
    ],
  }
  const parsed = ReconcileAndAdoptClassInputSchema.parse(valid)
  assert.equal(parsed.standardTerm.curie, "sosa:Observation")
  assert.equal(parsed.relationDecisions.length, 3)
})

test("ReconcileAndAdoptClassInputSchema rejects invalid UUIDs", () => {
  assert.throws(() => {
    ReconcileAndAdoptClassInputSchema.parse({
      ontologyId: "invalid-id",
      classId: "123",
      standardTerm: { curie: "", label: "" },
      retainedAttributeIds: [],
      relationDecisions: [],
    })
  })
})

test("ReconcileAndAdoptClassInputSchema handles empty relations and attributes", () => {
  const isolated: ReconcileAndAdoptClassInput = {
    ontologyId: "11111111-1111-4111-8111-111111111111",
    classId: "22222222-2222-4222-8222-222222222222",
    standardTerm: {
      curie: "sosa:Platform",
      label: "Platform",
    },
    retainedAttributeIds: [],
    relationDecisions: [],
  }
  const parsed = ReconcileAndAdoptClassInputSchema.parse(isolated)
  assert.equal(parsed.standardTerm.curie, "sosa:Platform")
})

import { reconcileAndAdoptClass } from "../src/features/ontology/server/actions/classes"

test("reconcileAndAdoptClass rejects invalid inputs before database access", async () => {
  await assert.rejects(
    () =>
      // @ts-expect-error test invalid raw input
      reconcileAndAdoptClass({
        ontologyId: "invalid",
        classId: "invalid",
      }),
    /invalid/i
  )
})

