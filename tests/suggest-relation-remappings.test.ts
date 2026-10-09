import assert from "node:assert/strict"
import { test } from "node:test"
import { parseAiRelationSuggestions } from "../src/features/ontology/server/services/ai-relation-reconciliation"

test("parseAiRelationSuggestions parses and validates raw JSON array", () => {
  const raw = JSON.stringify([
    {
      relationId: "44444444-4444-4444-8444-444444444444",
      suggestedAction: "remap",
      suggestedName: "sosa:observedProperty",
      rationale: "Aligns with the standard property for observations",
    },
    {
      relationId: "55555555-5555-4555-8555-555555555555",
      suggestedAction: "keep",
      rationale: "Domain-specific relation that remains valid",
    },
  ])
  const parsed = parseAiRelationSuggestions(raw)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].suggestedAction, "remap")
  assert.equal(parsed[0].suggestedName, "sosa:observedProperty")
})

test("parseAiRelationSuggestions strips markdown backticks", () => {
  const raw = "```json\n[{\"relationId\":\"11111111-1111-1111-1111-111111111111\",\"suggestedAction\":\"delete\",\"rationale\":\"Redundant\"}]\n```"
  const parsed = parseAiRelationSuggestions(raw)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].suggestedAction, "delete")
})

test("suggestRelationRemappings falls back to next model on 503 and tracks provenance", async () => {
  const { suggestRelationRemappings } = await import(
    "../src/features/ontology/server/services/ai-relation-reconciliation"
  )

  const originalFetch = globalThis.fetch
  let callCount = 0
  const calledModels: string[] = []

  // @ts-expect-error test mock
  globalThis.fetch = async (url: string | URL | Request) => {
    callCount++
    const urlStr = String(url)
    const modelMatch = urlStr.match(/models\/([^:]+):generateContent/)
    if (modelMatch) {
      calledModels.push(modelMatch[1])
    }

    if (callCount === 1) {
      // First model fails with 503 Service Unavailable
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "The model is overloaded. Please try again later.",
      }
    }

    // Second model succeeds
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      relationId: "rel-1",
                      suggestedAction: "remap",
                      suggestedName: "sosa:observedProperty",
                      rationale: "Standard SOSA property",
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    }
  }

  try {
    const result = await suggestRelationRemappings({
      ontologyId: "11111111-1111-4111-8111-111111111111",
      oldClassName: "Sensor",
      standardTermCurie: "sosa:Sensor",
      relations: [
        {
          id: "rel-1",
          name: "measures",
          domainClassName: "Sensor",
          rangeClassName: "Property",
          direction: "outgoing",
        },
      ],
      apiKey: "test-fake-key",
      model: "gemini-3.8-flash",
      candidateModels: ["gemini-3.8-flash", "gemini-2.5-flash"],
    })

    assert.equal(result.suggestions.length, 1)
    assert.equal(result.suggestions[0].relationId, "rel-1")
    assert.equal(result.provenance.successfulModel, "gemini-2.5-flash")
    assert.equal(result.provenance.attempts.length, 2)
    assert.equal(result.provenance.attempts[0].status, "failed")
    assert.equal(result.provenance.attempts[0].statusCode, 503)
    assert.equal(result.provenance.attempts[1].status, "succeeded")
  } finally {
    globalThis.fetch = originalFetch
  }
})

