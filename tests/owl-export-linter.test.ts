import assert from "node:assert/strict"
import { test } from "node:test"
import { buildOwlOntology } from "../src/features/ontology/server/owl-export/owl-builder"
import type { ImportOntology } from "../src/features/ontology/schemas/import"

function createBaseOntology(overrides: Partial<ImportOntology> = {}): ImportOntology {
  return {
    name: "Diagnostic Test Ontology",
    usecase: "Demonstrating OWL export diagnostic notes scaffolding",
    version: "1.0.0",
    defaultLanguage: "en",
    classes: [],
    relations: [],
    modules: [],
    relationAttributes: [],
    competencyQuestions: [],
    notes: [],
    examples: [],
    localizedTexts: [],
    languages: [],
    ...overrides,
  }
}

test("buildOwlOntology attaches diagnostic notes scaffolding when defects exist", () => {
  const ontologyWithDefects = createBaseOntology({
    classes: [
      {
        id: "c-1",
        name: "OrphanEntity",
        description: "", // triggers missing_description and orphan_class
        parentClassId: null,
        attributes: [],
      },
    ],
    relations: [
      {
        id: "r-1",
        name: "relatesToGhost",
        domainClassId: "c-1",
        rangeClassId: "c-non-existent", // triggers dangling_relation_range
        description: "Dangling relation",
      },
    ],
  })

  const owlXml = buildOwlOntology({
    baseIri: "https://example.org/test-ontology",
    ontology: ontologyWithDefects,
  })

  assert.ok(owlXml.includes("<owl:Ontology"), "Should contain owl:Ontology element")
  assert.ok(
    owlXml.includes("[Linter Diagnostics]"),
    "Should contain [Linter Diagnostics] summary in ontology comments"
  )
  assert.ok(
    owlXml.includes("dangling_relation_range") || owlXml.includes("relatesToGhost") || owlXml.includes("P10"),
    "Should include specific defect diagnostic notes in the OWL export"
  )
})

test("buildOwlOntology does not attach error diagnostics for clean connected ontology", () => {
  const cleanOntology = createBaseOntology({
    classes: [
      {
        id: "c-1",
        name: "Person",
        description: "A human being in the domain model",
        parentClassId: null,
        attributes: [
          {
            name: "fullName",
            dataType: "xsd:string",
            description: "Full name",
            required: true,
          },
        ],
      },
      {
        id: "c-2",
        name: "Organization",
        description: "An organized group of people",
        parentClassId: null,
        attributes: [
          {
            name: "orgName",
            dataType: "xsd:string",
            description: "Organization name",
            required: true,
          },
        ],
      },
    ],
    relations: [
      {
        id: "r-1",
        name: "memberOf",
        domainClassId: "c-1",
        rangeClassId: "c-2",
        description: "Person is a member of an organization",
        inverseName: "hasMember",
      },
      {
        id: "r-2",
        name: "hasMember",
        domainClassId: "c-2",
        rangeClassId: "c-1",
        description: "Organization has member",
        inverseName: "memberOf",
      },
    ],
  })

  const owlXml = buildOwlOntology({
    baseIri: "https://example.org/clean-ontology",
    ontology: cleanOntology,
  })

  assert.ok(owlXml.includes("<owl:Ontology"))
  assert.equal(
    owlXml.includes("[Diagnostic ERROR]"),
    false,
    "Clean ontology should not have error diagnostic annotations"
  )
})
