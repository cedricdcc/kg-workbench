import assert from "node:assert/strict"
import { test } from "node:test"

import type { EntityWithAttributes } from "../src/domain/documents"
import type {
  DocumentOntology,
  FactWithAnchors,
} from "../src/features/documents/server/queries/types"
import { getFactCompleteness } from "../src/features/documents/utils/fact-completeness"

function createMockFact(
  overrides: Partial<FactWithAnchors> = {}
): FactWithAnchors {
  return {
    id: "fact-1",
    extraction_run_id: "run-1",
    document_id: "doc-1",
    confidence: 0.95,
    primary_anchor_id: null,
    subject_entity_id: "entity-subj",
    subject_text: "Aspirin",
    subject_class_id: "class-drug",
    relation_type_id: "rel-treats",
    relation_text: "treats",
    object_entity_id: "entity-obj",
    object_text: "Headache",
    object_class_id: "class-disease",
    review_status: "pending",
    is_cross_chapter: false,
    created_at: new Date().toISOString(),
    anchors: [],
    relation_attribute_values: [],
    ...overrides,
  }
}

function createMockEntity(
  overrides: Partial<EntityWithAttributes> = {}
): EntityWithAttributes {
  return {
    id: "entity-1",
    document_id: "doc-1",
    extraction_run_id: null,
    entity_text: "Entity",
    class_id: "class-1",
    review_status: "pending",
    created_at: new Date().toISOString(),
    attributes: [],
    ...overrides,
  }
}

function createMockOntology(): DocumentOntology {
  return {
    classes: [
      { id: "class-drug", name: "Drug", module_id: null },
      { id: "class-disease", name: "Disease", module_id: null },
      { id: "class-org", name: "Organization", module_id: null },
    ],
    relations: [
      {
        id: "rel-treats",
        name: "treats",
        domain_class_id: "class-drug",
        range_class_id: "class-disease",
      },
    ],
    modules: [],
    attributes: [
      {
        id: "attr-dosage",
        name: "dosage",
        dataType: "xsd:string",
        classId: "class-drug",
        required: true,
      },
    ],
    relationAttributes: [],
    cqs: [],
    examples: [],
  }
}

test("getFactCompleteness validates conforming fact with required attributes", () => {
  const ontology = createMockOntology()
  const fact = createMockFact()

  const entitiesById = new Map<string, EntityWithAttributes>([
    [
      "entity-subj",
      createMockEntity({
        id: "entity-subj",
        entity_text: "Aspirin",
        class_id: "class-drug",
        attributes: [
          {
            id: "val-1",
            attribute_id: "attr-dosage",
            attribute_name: "dosage",
            data_type: "xsd:string",
            value: "500mg",
          },
        ],
      }),
    ],
    [
      "entity-obj",
      createMockEntity({
        id: "entity-obj",
        entity_text: "Headache",
        class_id: "class-disease",
      }),
    ],
  ])

  const result = getFactCompleteness(fact, ontology, entitiesById)
  assert.equal(result.isComplete, true)
  assert.equal(result.shaclViolations.length, 0)
})

test("getFactCompleteness detects SHACL range class mismatch and blocks completion", () => {
  const ontology = createMockOntology()
  // Object is incorrectly mapped to Organization instead of Disease
  const fact = createMockFact({
    object_class_id: "class-org",
  })

  const entitiesById = new Map<string, EntityWithAttributes>([
    [
      "entity-subj",
      createMockEntity({
        id: "entity-subj",
        entity_text: "Aspirin",
        class_id: "class-drug",
        attributes: [
          {
            id: "val-1",
            attribute_id: "attr-dosage",
            attribute_name: "dosage",
            data_type: "xsd:string",
            value: "500mg",
          },
        ],
      }),
    ],
    [
      "entity-obj",
      createMockEntity({
        id: "entity-obj",
        entity_text: "WHO",
        class_id: "class-org",
      }),
    ],
  ])

  const result = getFactCompleteness(fact, ontology, entitiesById)
  assert.equal(result.isComplete, false)
  assert.equal(result.shaclViolations.length, 1)
  assert.equal(result.shaclViolations[0].rule, "range")
  assert.ok(result.shaclViolations[0].message.includes("Disease"))
  assert.ok(result.shaclViolations[0].message.includes("Organization"))
})

test("getFactCompleteness detects SHACL domain class mismatch and blocks completion", () => {
  const ontology = createMockOntology()
  // Subject is incorrectly mapped to Organization instead of Drug
  const fact = createMockFact({
    subject_class_id: "class-org",
  })

  const entitiesById = new Map<string, EntityWithAttributes>([
    [
      "entity-subj",
      createMockEntity({
        id: "entity-subj",
        entity_text: "WHO",
        class_id: "class-org",
      }),
    ],
    [
      "entity-obj",
      createMockEntity({
        id: "entity-obj",
        entity_text: "Headache",
        class_id: "class-disease",
      }),
    ],
  ])

  const result = getFactCompleteness(fact, ontology, entitiesById)
  assert.equal(result.isComplete, false)
  assert.ok(result.shaclViolations.some((v) => v.rule === "domain"))
})

test("getFactCompleteness flags missing required entity attributes as SHACL violations", () => {
  const ontology = createMockOntology()
  // Subject has empty attributes (missing 'dosage')
  const fact = createMockFact()

  const entitiesById = new Map<string, EntityWithAttributes>([
    [
      "entity-subj",
      createMockEntity({
        id: "entity-subj",
        entity_text: "Aspirin",
        class_id: "class-drug",
        attributes: [], // Missing dosage!
      }),
    ],
    [
      "entity-obj",
      createMockEntity({
        id: "entity-obj",
        entity_text: "Headache",
        class_id: "class-disease",
      }),
    ],
  ])

  const result = getFactCompleteness(fact, ontology, entitiesById)
  assert.equal(result.isComplete, false)
  assert.ok(result.shaclViolations.some((v) => v.rule === "required_attribute"))
})
