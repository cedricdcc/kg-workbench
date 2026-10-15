import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateOntologyAssistance } from "../src/features/ontology/hooks/use-ontology-assist"

test("evaluateOntologyAssistance detects exact internal name collision", () => {
  const result = evaluateOntologyAssistance({
    query: "Sensor",
    entityType: "class",
    allClasses: [{ id: "1", name: "Sensor", module_id: "m1" }],
  })
  assert.equal(result.hasCollision, true)
  assert.ok(result.collisionMessage?.includes("already exists"))
})

test("evaluateOntologyAssistance suggests standard vocabulary term", () => {
  const result = evaluateOntologyAssistance({
    query: "Observes",
    entityType: "relation",
    allClasses: [],
    referenceTerms: [
      { curie: "sosa:observes", label: "observes", type: "property" },
    ],
  })
  assert.ok(result.standardSuggestion)
  assert.equal(result.standardSuggestion.curie, "sosa:observes")
})

test("evaluateOntologyAssistance detects hierarchy cycle for parent changes", () => {
  const result = evaluateOntologyAssistance({
    query: "Device",
    entityType: "class",
    targetClassId: "A",
    parentClassId: "C",
    allClasses: [
      { id: "A", name: "Device", parent_class_id: null },
      { id: "B", name: "SubDevice", parent_class_id: "A" },
      { id: "C", name: "LeafDevice", parent_class_id: "B" },
    ],
  })
  assert.equal(result.isCycle, true)
  assert.ok(result.cycleMessage?.includes("cycle"))
})
