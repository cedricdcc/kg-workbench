import { describe, it } from "node:test"
import assert from "node:assert/strict"
// @ts-expect-error - testing for export before implementation
import { ontologyCqTriples } from "../src/server/db/schema"

describe("ontologyCqTriples schema", () => {
  it("defines the table with required foreign keys and sort_order", () => {
    assert.ok(ontologyCqTriples, "ontologyCqTriples should be exported")
    assert.equal(ontologyCqTriples.cq_id.name, "cq_id")
    assert.equal(ontologyCqTriples.sort_order.name, "sort_order")
    assert.equal(ontologyCqTriples.subject_class_id.name, "subject_class_id")
    assert.equal(
      ontologyCqTriples.predicate_relation_id.name,
      "predicate_relation_id"
    )
    assert.equal(ontologyCqTriples.object_class_id.name, "object_class_id")
    assert.equal(
      ontologyCqTriples.subject_example_id.name,
      "subject_example_id"
    )
    assert.equal(
      ontologyCqTriples.predicate_example_id.name,
      "predicate_example_id"
    )
    assert.equal(ontologyCqTriples.object_example_id.name, "object_example_id")
  })
})
