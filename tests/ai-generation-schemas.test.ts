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

test("GeneratedAttributeSchema normalizes xsd:date and common aliases to valid database datatypes", () => {
  const dateAttr = GeneratedOntologyDraftSchema.parse({
    modules: [],
    classes: [
      {
        name: "Event",
        moduleName: "Core",
        attributes: [
          { name: "dateAttr", dataType: "xsd:date" },
          { name: "legacyDate", dataType: "date" },
          { name: "numAttr", dataType: "number" },
          { name: "intAttr", dataType: "xsd:integer" },
          { name: "boolAttr", dataType: "boolean" },
        ],
      },
    ],
    relations: [],
    cqMappings: [],
  })

  const attrs = dateAttr.classes[0].attributes
  assert.equal(attrs[0].dataType, "xsd:dateTime")
  assert.equal(attrs[1].dataType, "xsd:dateTime")
  assert.equal(attrs[2].dataType, "xsd:decimal")
  assert.equal(attrs[3].dataType, "xsd:integer")
  assert.equal(attrs[4].dataType, "xsd:boolean")
})
