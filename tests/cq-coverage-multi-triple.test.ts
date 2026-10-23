import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { evaluateCqCoverage } from "../src/features/ontology/utils/cq-coverage"
import type { OntologyCQWithModules } from "../src/features/ontology/server/queries"

describe("evaluateCqCoverage multi-triple", () => {
  const classes = [
    {
      id: "c1",
      name: "Station",
      ontology_id: "o1",
      module_id: null,
      description: "",
      parent_class_id: null,
      instance_policy: "open",
      attributes: [],
    },
    {
      id: "c2",
      name: "Sensor",
      ontology_id: "o1",
      module_id: null,
      description: "",
      parent_class_id: null,
      instance_policy: "open",
      attributes: [],
    },
    {
      id: "c3",
      name: "Temperature",
      ontology_id: "o1",
      module_id: null,
      description: "",
      parent_class_id: null,
      instance_policy: "open",
      attributes: [],
    },
  ]
  const relations = [
    {
      id: "r1",
      name: "hasSensor",
      ontology_id: "o1",
      domain_class_id: "c1",
      range_class_id: "c2",
      description: "",
      inverse_name: null,
      cardinality: null,
      instance_policy: "open",
    },
    {
      id: "r2",
      name: "measuresProperty",
      ontology_id: "o1",
      domain_class_id: "c2",
      range_class_id: "c3",
      description: "",
      inverse_name: null,
      cardinality: null,
      instance_policy: "open",
    },
  ]

  it("evaluates to full when all hops in a multi-hop path are mapped to existing classes and relations", () => {
    const cq: OntologyCQWithModules = {
      id: "cq-1",
      ontology_id: "o1",
      question: "Which sensors measure temperature on station?",
      sort_order: 0,
      created_at: new Date().toISOString(),
      subject_class_id: null,
      predicate_relation_id: null,
      object_class_id: null,
      subject_example_id: null,
      predicate_example_id: null,
      object_example_id: null,
      modules: [],
      triples: [
        {
          id: "t1",
          cq_id: "cq-1",
          sort_order: 0,
          subject_class_id: "c1",
          predicate_relation_id: "r1",
          object_class_id: "c2",
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: "t2",
          cq_id: "cq-1",
          sort_order: 1,
          subject_class_id: "c2",
          predicate_relation_id: "r2",
          object_class_id: "c3",
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          created_at: new Date().toISOString(),
        },
      ],
    }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "full")
    assert.equal(result.totalTriples, 2)
    assert.equal(result.mappedTriples, 2)
  })

  it("evaluates to partial when only some hops in a multi-hop path are mapped", () => {
    const cq: OntologyCQWithModules = {
      id: "cq-2",
      ontology_id: "o1",
      question: "Which sensors measure temp on station?",
      sort_order: 0,
      created_at: new Date().toISOString(),
      subject_class_id: null,
      predicate_relation_id: null,
      object_class_id: null,
      subject_example_id: null,
      predicate_example_id: null,
      object_example_id: null,
      modules: [],
      triples: [
        {
          id: "t1",
          cq_id: "cq-2",
          sort_order: 0,
          subject_class_id: "c1",
          predicate_relation_id: "r1",
          object_class_id: "c2",
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          created_at: new Date().toISOString(),
        },
        {
          id: "t2",
          cq_id: "cq-2",
          sort_order: 1,
          subject_class_id: "c2",
          predicate_relation_id: null,
          object_class_id: null,
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          created_at: new Date().toISOString(),
        },
      ],
    }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "partial")
    assert.equal(result.totalTriples, 2)
    assert.equal(result.mappedTriples, 1)
  })

  it("evaluates to unmapped when zero triples exist and legacy fields are empty", () => {
    const cq: OntologyCQWithModules = {
      id: "cq-3",
      ontology_id: "o1",
      question: "Unmapped question?",
      sort_order: 0,
      created_at: new Date().toISOString(),
      subject_class_id: null,
      predicate_relation_id: null,
      object_class_id: null,
      subject_example_id: null,
      predicate_example_id: null,
      object_example_id: null,
      modules: [],
      triples: [],
    }
    const result = evaluateCqCoverage(cq, classes, relations)
    assert.equal(result.status, "unmapped")
    assert.equal(result.totalTriples, 0)
    assert.equal(result.mappedTriples, 0)
  })
})
