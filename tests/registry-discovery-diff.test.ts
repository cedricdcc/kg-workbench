import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { extractDomainKeywords } from "../src/features/ontology/server/services/vocabulary-registries/domain-discovery"

describe("domain-discovery keyword extraction", () => {
  it("extracts relevant noun phrases and removes stop words from CQs", () => {
    const cqs = [
      {
        question:
          "Which sensors measure water temperature on the weather station?",
      },
      { question: "What is the platform observation interval?" },
    ]
    const keywords = extractDomainKeywords(
      "Marine Environmental Monitoring",
      cqs
    )
    const lower = keywords.map((k) => k.toLowerCase())

    assert.ok(
      lower.includes("sensor") || lower.includes("sensors"),
      "should include sensor"
    )
    assert.ok(lower.includes("temperature"), "should include temperature")
    assert.ok(lower.includes("platform"), "should include platform")
    assert.ok(lower.includes("station"), "should include station")
    assert.ok(!lower.includes("which"), "should filter out 'which'")
    assert.ok(!lower.includes("what"), "should filter out 'what'")
    assert.ok(!lower.includes("the"), "should filter out 'the'")
    assert.ok(!lower.includes("is"), "should filter out 'is'")
  })
})
