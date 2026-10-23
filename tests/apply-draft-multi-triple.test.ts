import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { GeneratedOntologyDraftSchema } from "../src/features/ontology/schemas/ai-generation"

describe("Draft application validation", () => {
  it("parses draft with multi-triple mappings", () => {
    const draft = {
      modules: [{ name: "Core", description: "" }],
      classes: [
        { name: "Buoy", moduleName: "Core", description: "", attributes: [] },
        { name: "Sensor", moduleName: "Core", description: "", attributes: [] },
      ],
      relations: [
        {
          name: "hasSensor",
          domainClassName: "Buoy",
          rangeClassName: "Sensor",
          description: "",
        },
      ],
      cqMappings: [
        {
          cqId: "550e8400-e29b-41d4-a716-446655440000",
          moduleNames: ["Core"],
          triples: [
            {
              subjectClassName: "Buoy",
              predicateRelationName: "hasSensor",
              objectClassName: "Sensor",
            },
          ],
        },
      ],
      suggestedContext: [],
    }
    const parsed = GeneratedOntologyDraftSchema.parse(draft)
    assert.equal(parsed.cqMappings[0].triples.length, 1)
    assert.equal(parsed.cqMappings[0].triples[0].subjectClassName, "Buoy")
  })
})
