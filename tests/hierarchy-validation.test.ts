import assert from "node:assert/strict"
import { test } from "node:test"
import {
  computeInheritedAttributesAndRelations,
  validateHierarchyAcyclicity,
} from "../src/features/ontology/utils/hierarchy-validation"
import { buildOwlOntology } from "../src/features/ontology/server/owl-export/owl-builder/build-owl-ontology"

test("validateHierarchyAcyclicity detects direct and transitive cycles", () => {
  const classes = [
    { id: "A", parent_class_id: null },
    { id: "B", parent_class_id: "A" },
    { id: "C", parent_class_id: "B" },
  ]

  // Valid: C parent remains B
  assert.equal(validateHierarchyAcyclicity("C", "B", classes).valid, true)

  // Invalid: Setting A parent to C creates A -> C -> B -> A cycle
  const invalid = validateHierarchyAcyclicity("A", "C", classes)
  assert.equal(invalid.valid, false)
  assert.deepEqual(invalid.cyclePath, ["A", "C", "B", "A"])

  // Invalid: Self-parenting
  assert.equal(validateHierarchyAcyclicity("A", "A", classes).valid, false)
})

test("computeInheritedAttributesAndRelations walks ancestors and derives properties", () => {
  const classes = [
    {
      id: "device",
      name: "Device",
      description: "A physical device",
      instance_policy: "free",
      ontology_id: "ont-1",
      parent_class_id: null,
      module_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attributes: [
        {
          id: "attr-serial",
          class_id: "device",
          name: "serialNumber",
          data_type: "string",
          required: true,
          description: "Serial number",
          sort_order: 0,
        },
      ],
    },
    {
      id: "sensor",
      name: "Sensor",
      description: "A sensor device",
      instance_policy: "free",
      ontology_id: "ont-1",
      parent_class_id: "device",
      module_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attributes: [
        {
          id: "attr-accuracy",
          class_id: "sensor",
          name: "accuracy",
          data_type: "number",
          required: false,
          description: "Accuracy rating",
          sort_order: 0,
        },
      ],
    },
  ]

  const relations = [
    {
      id: "rel-loc",
      ontology_id: "ont-1",
      name: "locatedIn",
      domain_class_id: "device",
      range_class_id: "room",
      description: "Device location",
      inverse_name: null,
      cardinality: null,
      instance_policy: "free",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  const { inheritedAttributes, inheritedRelations } =
    computeInheritedAttributesAndRelations("sensor", classes, relations)

  assert.equal(inheritedAttributes.length, 1)
  assert.equal(inheritedAttributes[0].name, "serialNumber")
  assert.equal(inheritedAttributes[0].inheritedFromClassName, "Device")

  assert.equal(inheritedRelations.length, 1)
  assert.equal(inheritedRelations[0].name, "locatedIn")
  assert.equal(inheritedRelations[0].inheritedFromClassName, "Device")
})

test("buildOwlOntology serializes owl:disjointWith and cardinality restrictions", () => {
  const xml = buildOwlOntology({
    baseIri: "http://example.org/test#",
    ontology: {
      name: "Test Ontology",
      usecase: "Testing",
      version: "1.0.0",
      defaultLanguage: "en",
      languages: [{ code: "en", label: "English" }],
      modules: [],
      notes: [],
      examples: [],
      localizedTexts: [],
      competencyQuestions: [],
      relations: [],
      relationAttributes: [],
      classes: [
        {
          id: "cls-a",
          name: "ClassA",
          description: "First class",
          disjointWithClassIds: ["cls-b"],
          restrictions: [
            {
              propertyIri: "http://example.org/test#hasPart",
              type: "exact",
              cardinality: 1,
            },
          ],
          attributes: [],
        },
        {
          id: "cls-b",
          name: "ClassB",
          description: "Second class",
          disjointWithClassIds: [],
          restrictions: [],
          attributes: [],
        },
      ],
    },
  })

  assert.ok(
    xml.includes(
      'owl:disjointWith rdf:resource="http://example.org/test#ClassB"'
    )
  )
  assert.ok(
    xml.includes(
      '<owl:onProperty rdf:resource="http://example.org/test#hasPart"/>'
    )
  )
  assert.ok(xml.includes("<owl:qualifiedCardinality"))
})
