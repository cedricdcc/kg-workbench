import assert from "node:assert/strict"
import { test } from "node:test"
import { validateTriplesAgainstShacl } from "../src/features/ontology/server/shacl/validator"
import { ImportOntologySchema } from "../src/features/ontology/schemas/import"

test("validateTriplesAgainstShacl passes when triples conform to shapes", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Medical",
    defaultLanguage: "en",
    classes: [
      {
        id: "c-1",
        name: "Drug",
        attributes: [
          { name: "dosage", dataType: "xsd:string", required: true },
        ],
      },
      { id: "c-2", name: "Disease", attributes: [] },
    ],
    relations: [
      { id: "r-1", name: "treats", domainClassId: "c-1", rangeClassId: "c-2" },
    ],
  })

  const candidateTriples = [
    {
      subjectText: "Aspirin",
      subjectClass: "Drug",
      relationText: "treats",
      objectText: "Headache",
      objectClass: "Disease",
      attributes: { dosage: "500mg" },
    },
  ]

  const report = validateTriplesAgainstShacl({
    triples: candidateTriples,
    ontology,
  })

  assert.equal(report.conforms, true)
  assert.equal(report.results.length, 0)
})

test("validateTriplesAgainstShacl detects range class violations", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Medical",
    defaultLanguage: "en",
    classes: [
      { id: "c-1", name: "Drug", attributes: [] },
      { id: "c-2", name: "Disease", attributes: [] },
      { id: "c-3", name: "Organization", attributes: [] },
    ],
    relations: [
      { id: "r-1", name: "treats", domainClassId: "c-1", rangeClassId: "c-2" },
    ],
  })

  const candidateTriples = [
    {
      subjectText: "Aspirin",
      subjectClass: "Drug",
      relationText: "treats",
      objectText: "WHO",
      objectClass: "Organization", // Invalid range: expected Disease!
    },
  ]

  const report = validateTriplesAgainstShacl({
    triples: candidateTriples,
    ontology,
  })

  assert.equal(report.conforms, false)
  assert.equal(report.results.length, 1)
  assert.equal(report.results[0].resultSeverity, "Violation")
  assert.ok(report.results[0].resultMessage.includes("Disease"))
})

test("validateTriplesAgainstShacl flags missing required attributes", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Medical",
    defaultLanguage: "en",
    classes: [
      {
        id: "c-1",
        name: "Drug",
        attributes: [
          { name: "dosage", dataType: "xsd:string", required: true },
        ],
      },
      { id: "c-2", name: "Disease", attributes: [] },
    ],
    relations: [
      { id: "r-1", name: "treats", domainClassId: "c-1", rangeClassId: "c-2" },
    ],
  })

  const candidateTriples = [
    {
      subjectText: "Aspirin",
      subjectClass: "Drug",
      relationText: "treats",
      objectText: "Headache",
      objectClass: "Disease",
      attributes: {}, // Missing required 'dosage'!
    },
  ]

  const report = validateTriplesAgainstShacl({
    triples: candidateTriples,
    ontology,
  })

  assert.equal(report.conforms, false)
  assert.equal(report.results.length, 1)
  assert.equal(report.results[0].resultPath, "dosage")
  assert.ok(report.results[0].resultMessage.toLowerCase().includes("required"))
})
