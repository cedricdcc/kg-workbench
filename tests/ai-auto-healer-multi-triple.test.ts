import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { autoHealOntologyDraft } from "../src/features/ontology/server/services/ai-ontology-generator/draft-guardrails"
import type { GeneratedOntologyDraft } from "../src/features/ontology/schemas/ai-generation"

describe("autoHealOntologyDraft multi-triple", () => {
  it("synthesizes missing classes referenced in CQ triples", () => {
    const rawDraft: GeneratedOntologyDraft = {
      modules: [{ name: "Environment", description: "" }],
      classes: [
        {
          name: "Buoy",
          moduleName: "Environment",
          description: "",
          attributes: [],
        },
      ],
      relations: [],
      cqMappings: [
        {
          cqId: "550e8400-e29b-41d4-a716-446655440000",
          moduleNames: ["Environment"],
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

    const { draft, healedIssues } = autoHealOntologyDraft(rawDraft)
    assert.ok(
      draft.classes.some((c) => c.name.toLowerCase() === "sensor"),
      "should auto-synthesize missing class Sensor"
    )
    assert.ok(
      draft.relations.some((r) => r.name.toLowerCase() === "hassensor"),
      "should auto-synthesize missing relation hasSensor"
    )
    assert.ok(healedIssues.length > 0)
  })
})
