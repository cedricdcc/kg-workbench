import assert from "node:assert/strict"
import { test } from "node:test"
import {
  SUPPORTED_ENTITY_TYPES,
  formatEntityTypeLabel,
} from "../src/features/ontology/components/entity-type-tabs-types"

test("SUPPORTED_ENTITY_TYPES contains all 5 tabs including reasoner and datasets", () => {
  assert.deepEqual(SUPPORTED_ENTITY_TYPES, [
    "classes",
    "relations",
    "standards",
    "reasoner",
    "datasets",
  ])
})

test("formatEntityTypeLabel formats tab titles with counts", () => {
  assert.equal(formatEntityTypeLabel("classes", 12), "Classes (12)")
  assert.equal(formatEntityTypeLabel("relations", 5), "Relations (5)")
  assert.equal(formatEntityTypeLabel("standards", 2), "Standards (2)")
  assert.equal(formatEntityTypeLabel("reasoner"), "Reasoner")
  assert.equal(formatEntityTypeLabel("datasets", 3), "Datasets (3)")
})
