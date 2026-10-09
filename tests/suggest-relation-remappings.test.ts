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
