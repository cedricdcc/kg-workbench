import assert from "node:assert/strict"
import { test } from "node:test"
import { buildShaclShapes } from "../src/features/ontology/server/shacl/generator"
import { ImportOntologySchema } from "../src/features/ontology/schemas/import"

test("buildShaclShapes generates standard W3C SHACL Turtle with prefixes", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Medical Ontology",
    usecase: "Healthcare knowledge modeling",
    defaultLanguage: "en",
    modules: [],
    classes: [
      {
        id: "c-1",
        name: "Drug",
        description: "Pharmaceutical substance",
        attributes: [
          {
            name: "dosage",
            dataType: "xsd:string",
            required: true,
          },
          {
            name: "trialCount",
            dataType: "xsd:integer",
            required: false,
          },
        ],
      },
      {
        id: "c-2",
        name: "Disease",
        description: "Medical condition",
        attributes: [],
      },
    ],
    relations: [
      {
        id: "r-1",
        name: "treats",
        domainClassId: "c-1",
        rangeClassId: "c-2",
        cardinality: "1:N",
        description: "Links drug to treated disease",
      },
    ],
  })

  const turtle = buildShaclShapes({
    baseIri: "http://example.org/medical",
    ontology,
  })

  // Prefixes
  assert.ok(turtle.includes("@prefix sh: <http://www.w3.org/ns/shacl#> ."))
  assert.ok(
    turtle.includes("@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .")
  )
  assert.ok(turtle.includes("@prefix ont: <http://example.org/medical#> ."))

  // Drug NodeShape targeting Drug class
  assert.ok(turtle.includes("ont:DrugShape"))
  assert.ok(turtle.includes("a sh:NodeShape"))
  assert.ok(turtle.includes("sh:targetClass ont:Drug"))

  // Required attribute dosage
  assert.ok(turtle.includes("sh:path ont:dosage"))
  assert.ok(turtle.includes("sh:datatype xsd:string"))
  assert.ok(turtle.includes("sh:minCount 1"))

  // Optional attribute trialCount
  assert.ok(turtle.includes("sh:path ont:trialCount"))
  assert.ok(turtle.includes("sh:datatype xsd:integer"))

  // Relation treats to Disease with 1:N cardinality (minCount 1)
  assert.ok(turtle.includes("sh:path ont:treats"))
  assert.ok(turtle.includes("sh:class ont:Disease"))
})

test("buildShaclShapes supports closed shapes option", () => {
  const ontology = ImportOntologySchema.parse({
    name: "Strict Ontology",
    defaultLanguage: "en",
    classes: [
      {
        id: "c-1",
        name: "Person",
        attributes: [],
      },
    ],
    relations: [],
  })

  const turtle = buildShaclShapes({
    baseIri: "http://example.org/strict",
    ontology,
    closed: true,
  })

  assert.ok(turtle.includes("sh:closed true"))
})
