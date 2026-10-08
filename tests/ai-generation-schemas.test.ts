import assert from "node:assert/strict"
import { test } from "node:test"

import {
  GeneratedOntologyDraftSchema,
  sanitizeAiJsonResponse,
} from "../src/features/ontology/schemas/ai-generation"

test("sanitizeAiJsonResponse strips markdown fences and extracts json", () => {
  const fenced = "```json\n{\"modules\": []}\n```"
  assert.equal(sanitizeAiJsonResponse(fenced), "{\"modules\": []}")

  const tripleFencedWithTrailing = "Some text before\n```json\n{\"modules\": []}\n```\nSome text after"
  assert.equal(sanitizeAiJsonResponse(tripleFencedWithTrailing), "{\"modules\": []}")

  const rawJson = "{\"modules\": []}"
  assert.equal(sanitizeAiJsonResponse(rawJson), "{\"modules\": []}")
})

test("GeneratedOntologyDraftSchema validates valid draft structure", () => {
  const sample = {
    modules: [{ name: "Core", description: "Core module" }],
    classes: [
      {
        name: "User",
        description: "User entity",
        moduleName: "Core",
        attributes: [
          {
            name: "email",
            dataType: "xsd:string",
            description: "Email address",
          },
        ],
      },
    ],
    relations: [
      {
        name: "hasProfile",
        description: "Links user to profile",
        domainClassName: "User",
        rangeClassName: "Profile",
      },
    ],
    cqMappings: [
      {
        cqId: "123e4567-e89b-12d3-a456-426614174000",
        subjectClassName: "User",
        predicateRelationName: "hasProfile",
        objectClassName: "Profile",
        moduleNames: ["Core"],
      },
    ],
  }
  const parsed = GeneratedOntologyDraftSchema.parse(sample)
  assert.equal(parsed.modules.length, 1)
  assert.equal(parsed.classes[0].name, "User")
  assert.equal(parsed.relations[0].name, "hasProfile")
  assert.equal(parsed.cqMappings[0].subjectClassName, "User")
})

test("GeneratedOntologyDraftSchema rejects invalid CQ uuid", () => {
  const invalid = {
    modules: [],
    classes: [],
    relations: [],
    cqMappings: [
      {
        cqId: "not-a-uuid",
        subjectClassName: "User",
        predicateRelationName: "hasProfile",
        objectClassName: "Profile",
        moduleNames: [],
      },
    ],
  }
  assert.throws(() => GeneratedOntologyDraftSchema.parse(invalid))
})
