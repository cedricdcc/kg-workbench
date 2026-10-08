import assert from "node:assert/strict"
import { test } from "node:test"

import { buildOntologyGenerationPrompt } from "../src/features/ontology/server/services/ai-ontology-generator/prompt-builder"

test("buildOntologyGenerationPrompt constructs system and user prompt with CQ list", () => {
  const result = buildOntologyGenerationPrompt({
    ontologyName: "Supply Chain",
    usecase: "Track orders and vendors",
    existingModules: ["Logistics"],
    existingClasses: ["Warehouse"],
    existingRelations: ["suppliesTo"],
    competencyQuestions: [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        question: "Which supplier delivers to which warehouse?",
      },
    ],
  })

  assert.ok(result.systemPrompt.length > 0)
  assert.ok(result.userPrompt.includes("Supply Chain"))
  assert.ok(result.userPrompt.includes("Which supplier delivers to which warehouse?"))
  assert.ok(result.userPrompt.includes("Logistics"))
  assert.ok(result.userPrompt.includes("Warehouse"))
  assert.ok(result.userPrompt.includes("suppliesTo"))
})

test("buildOntologyGenerationPrompt ignores empty or whitespace questions", () => {
  const result = buildOntologyGenerationPrompt({
    ontologyName: "Test",
    usecase: "Test",
    existingModules: [],
    existingClasses: [],
    existingRelations: [],
    competencyQuestions: [
      { id: "123e4567-e89b-12d3-a456-426614174000", question: "  " },
      { id: "223e4567-e89b-12d3-a456-426614174000", question: "Valid question?" },
    ],
  })

  assert.ok(result.userPrompt.includes("Valid question?"))
  assert.ok(!result.userPrompt.includes('"question": "  "'))
})
