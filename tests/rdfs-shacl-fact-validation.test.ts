import assert from "node:assert/strict"
import { test } from "node:test"
import { ImportOntologySchema } from "../src/features/ontology/schemas/import"
import { validateTriplesAgainstShacl } from "../src/features/ontology/server/shacl/validator"

test("Researcher (parentClassId -> Person) satisfies relation with Person domain and range", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Academic",
    defaultLanguage: "en",
    classes: [
      { id: "c-person", name: "Person", attributes: [] },
      {
        id: "c-researcher",
        name: "Researcher",
        parentClassId: "c-person",
        attributes: [],
      },
    ],
    relations: [
      {
        id: "r-collaborates",
        name: "collaboratesWith",
        domainClassId: "c-person",
        rangeClassId: "c-person",
      },
    ],
  })

  const report = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "collaboratesWith",
        objectText: "Bob",
        objectClass: "Researcher",
      },
    ],
    ontology,
  })

  assert.equal(report.conforms, true)
  assert.equal(report.results.length, 0)
})

test("rdfsTtl rdfs:subClassOf closure satisfies relation with Person domain and range", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Academic",
    defaultLanguage: "en",
    classes: [
      { id: "c-person", name: "Person", attributes: [] },
      { id: "c-researcher", name: "Researcher", attributes: [] },
      { id: "c-fellow", name: "PostdocFellow", attributes: [] },
    ],
    relations: [
      {
        id: "r-mentors",
        name: "mentors",
        domainClassId: "c-person",
        rangeClassId: "c-person",
      },
    ],
  })

  const rdfsTtl = `
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/> .

    ex:Researcher rdfs:subClassOf ex:Person .
    ex:PostdocFellow rdfs:subClassOf ex:Researcher .
  `

  const report = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Dr. Smith",
        subjectClass: "PostdocFellow",
        relationText: "mentors",
        objectText: "Jane",
        objectClass: "Researcher",
      },
    ],
    ontology,
    rdfsTtl,
  })

  assert.equal(report.conforms, true)
  assert.equal(report.results.length, 0)
})

test("non-subclass Organization triggers range Violation when Person is expected", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Academic",
    defaultLanguage: "en",
    classes: [
      { id: "c-person", name: "Person", attributes: [] },
      {
        id: "c-researcher",
        name: "Researcher",
        parentClassId: "c-person",
        attributes: [],
      },
      { id: "c-org", name: "Organization", attributes: [] },
    ],
    relations: [
      {
        id: "r-mentors",
        name: "mentors",
        domainClassId: "c-person",
        rangeClassId: "c-person",
      },
    ],
  })

  const report = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "mentors",
        objectText: "CERN",
        objectClass: "Organization",
      },
    ],
    ontology,
  })

  assert.equal(report.conforms, false)
  assert.equal(report.results.length, 1)
  assert.equal(report.results[0].resultSeverity, "Violation")
  assert.ok(report.results[0].resultMessage.includes("Person"))
})

test("Researcher inherits required attributes from Person", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Academic",
    defaultLanguage: "en",
    classes: [
      {
        id: "c-person",
        name: "Person",
        attributes: [
          { name: "fullName", dataType: "xsd:string", required: true },
        ],
      },
      {
        id: "c-researcher",
        name: "Researcher",
        parentClassId: "c-person",
        attributes: [
          { name: "orcid", dataType: "xsd:string", required: false },
        ],
      },
    ],
    relations: [],
  })

  const missingReport = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "hasRole",
        objectText: "PI",
        attributes: {},
      },
    ],
    ontology,
  })

  assert.equal(missingReport.conforms, false)
  assert.equal(missingReport.results.length, 1)
  assert.equal(missingReport.results[0].resultSeverity, "Violation")
  assert.equal(missingReport.results[0].resultPath, "fullName")

  const validReport = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "hasRole",
        objectText: "PI",
        attributes: { fullName: "Alice Lovelace" },
      },
    ],
    ontology,
  })

  assert.equal(validReport.conforms, true)
  assert.equal(validReport.results.length, 0)
})

test("shaclTtl enforces additional sh:minCount 1 constraints", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Academic",
    defaultLanguage: "en",
    classes: [
      { id: "c-person", name: "Person", attributes: [] },
      {
        id: "c-researcher",
        name: "Researcher",
        parentClassId: "c-person",
        attributes: [],
      },
    ],
    relations: [],
  })

  const shaclTtl = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix ex: <http://example.org/> .

    ex:PersonShape a sh:NodeShape ;
      sh:targetClass ex:Person ;
      sh:property [
        sh:path ex:email ;
        sh:minCount 1 ;
      ] .
  `

  const missingReport = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "authored",
        objectText: "Paper1",
        attributes: {},
      },
    ],
    ontology,
    shaclTtl,
  })

  assert.equal(missingReport.conforms, false)
  assert.equal(missingReport.results.length, 1)
  assert.equal(missingReport.results[0].resultSeverity, "Violation")
  assert.equal(missingReport.results[0].resultPath, "email")

  const validReport = validateTriplesAgainstShacl({
    triples: [
      {
        subjectText: "Alice",
        subjectClass: "Researcher",
        relationText: "authored",
        objectText: "Paper1",
        attributes: { email: "alice@example.org" },
      },
    ],
    ontology,
    shaclTtl,
  })

  assert.equal(validReport.conforms, true)
  assert.equal(validReport.results.length, 0)
})
