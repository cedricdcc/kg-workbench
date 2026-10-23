import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GeneratedCQMappingSchema } from "../src/features/ontology/schemas/ai-generation"

describe("GeneratedCQMappingSchema multi-triple", () => {
  it("validates an ordered array of connected triples", () => {
    const raw = {
      cqId: "550e8400-e29b-41d4-a716-446655440000",
      moduleNames: ["Sensors"],
      triples: [
        {
          subjectClassName: "Station",
          predicateRelationName: "hasSensor",
          objectClassName: "Sensor",
        },
        {
          subjectClassName: "Sensor",
          predicateRelationName: "measuresProperty",
          objectClassName: "Temperature",
        },
      ],
    }
    const parsed = GeneratedCQMappingSchema.parse(raw)
    assert.equal(parsed.triples.length, 2)
    assert.equal(parsed.triples[0].predicateRelationName, "hasSensor")
    assert.equal(parsed.triples[1].predicateRelationName, "measuresProperty")
  })

  it("supports backwards compatibility if single triple fields are present without triples array", () => {
    const legacyRaw = {
      cqId: "550e8400-e29b-41d4-a716-446655440001",
      subjectClassName: "Station",
      predicateRelationName: "hasSensor",
      objectClassName: "Sensor",
      moduleNames: ["Sensors"],
    }
    const parsed = GeneratedCQMappingSchema.parse(legacyRaw)
    assert.equal(parsed.triples.length, 1)
    assert.equal(parsed.triples[0].subjectClassName, "Station")
    assert.equal(parsed.triples[0].predicateRelationName, "hasSensor")
    assert.equal(parsed.triples[0].objectClassName, "Sensor")
  })
})
