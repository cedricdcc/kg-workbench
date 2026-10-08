import assert from "node:assert/strict"
import { test } from "node:test"
import { expandContextualConnections } from "../src/features/ontology/server/services/ai-ontology-generator/contextual-expansion"
import {
  EntityAlignmentSchema,
  GeneratedClassSchema,
} from "../src/features/ontology/schemas/ai-generation"

test("EntityAlignmentSchema validates alignment with rationale", () => {
  const alignment = {
    mode: "subClassOf",
    targetCurie: "sosa:Platform",
    targetIri: "http://www.w3.org/ns/sosa/Platform",
    similarityScore: 0.92,
    rationale: "Observatories host sensors and act as observation platforms.",
  }
  const parsed = EntityAlignmentSchema.parse(alignment)
  assert.equal(parsed.targetCurie, "sosa:Platform")
  assert.equal(parsed.mode, "subClassOf")
})

test("GeneratedClassSchema optionally accepts alignment", () => {
  const cls = {
    name: "EMOBON_Observatory",
    moduleName: "Sampling",
    alignment: {
      mode: "subClassOf",
      targetCurie: "sosa:Platform",
      targetIri: "http://www.w3.org/ns/sosa/Platform",
      rationale: "Observatory is a platform",
    },
  }
  const parsed = GeneratedClassSchema.parse(cls)
  assert.ok(parsed.alignment)
  assert.equal(parsed.alignment?.targetCurie, "sosa:Platform")
})

test("expandContextualConnections discovers parent classes and direct properties without cycle loops", () => {
  const catalog = [
    {
      curie: "sosa:Observation",
      iri: "http://www.w3.org/ns/sosa/Observation",
      label: "Observation",
      parentIris: ["http://www.w3.org/ns/sosa/FeatureOfInterest"],
      relatedPropertyIris: ["http://www.w3.org/ns/sosa/hasFeatureOfInterest"],
    },
    {
      curie: "sosa:FeatureOfInterest",
      iri: "http://www.w3.org/ns/sosa/FeatureOfInterest",
      label: "Feature of Interest",
      parentIris: [],
      relatedPropertyIris: [],
    },
  ]
  const expanded = expandContextualConnections(["sosa:Observation"], catalog)
  assert.equal(expanded.suggestedParents.length, 1)
  assert.equal(expanded.suggestedParents[0].curie, "sosa:FeatureOfInterest")
})
