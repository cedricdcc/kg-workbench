import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type {
  CanonicalOntologySnapshot,
  OntologyUiLayout,
} from "../src/features/ontology/server/linkml/types"
import {
  diffLinkmlSnapshots,
  cascadeSymbolRename,
  cascadeSymbolDelete,
  type SymbolDiffReport,
  type DbTransaction,
} from "../src/features/ontology/server/linkml/symbol-cascade"
import {
  loadCanonicalOntology,
  saveCanonicalOntology,
  type DbClient,
} from "../src/features/ontology/server/linkml/document-store"
import { snapshotToLinkmlYaml } from "../src/features/ontology/server/linkml/ast-mapper"

function getTableName(table: unknown): string {
  const obj = table as { [key: symbol]: string; _?: { name?: string } }
  return obj[Symbol.for("drizzle:Name")] || obj._?.name || ""
}

describe("diffLinkmlSnapshots AST Diff Engine", () => {
  it("detects renamed class (oldKey: Person, newKey: Individual) and deleted class (Component)", () => {
    const before: CanonicalOntologySnapshot = {
      document: {
        id: "ont-1",
        name: "TestOntology",
        version: "1.0.0",
      },
      modules: [{ id: "Core", name: "Core" }],
      classes: [
        {
          id: "Person",
          name: "Person",
          module_id: "Core",
          description: "A human being",
        },
        {
          id: "Component",
          name: "Component",
          module_id: "Core",
          description: "A system component",
        },
      ],
      attributes: [
        {
          id: "Person.age",
          class_id: "Person",
          name: "age",
          data_type: "xsd:integer",
        },
      ],
      relations: [
        {
          id: "works_for",
          name: "works_for",
          domain_class_id: "Person",
          range_class_id: "Organization",
        },
      ],
      relation_attributes: [],
      ui_layout: {
        classPositions: {
          Core: {
            Person: { x: 100, y: 150 },
            Component: { x: 300, y: 400 },
          },
        },
        moduleLayouts: {
          Core: { x: 50, y: 50, width: 400, height: 400 },
        },
      },
    }

    const after: CanonicalOntologySnapshot = {
      document: {
        id: "ont-1",
        name: "TestOntology",
        version: "1.0.0",
      },
      modules: [{ id: "Core", name: "Core" }],
      classes: [
        {
          id: "Individual",
          name: "Individual",
          module_id: "Core",
          description: "A human being",
        },
      ],
      attributes: [
        {
          id: "Individual.age",
          class_id: "Individual",
          name: "age",
          data_type: "xsd:integer",
        },
      ],
      relations: [
        {
          id: "works_for",
          name: "works_for",
          domain_class_id: "Individual",
          range_class_id: "Organization",
        },
      ],
      relation_attributes: [],
      ui_layout: {
        classPositions: {
          Core: {
            Individual: { x: 100, y: 150 },
          },
        },
        moduleLayouts: {
          Core: { x: 50, y: 50, width: 400, height: 400 },
        },
      },
    }

    const diff: SymbolDiffReport = diffLinkmlSnapshots(before, after)

    assert.equal(diff.renamedClasses.length, 1)
    assert.deepEqual(diff.renamedClasses[0], {
      oldKey: "Person",
      newKey: "Individual",
    })

    assert.equal(diff.deletedClasses.length, 1)
    assert.equal(diff.deletedClasses[0], "Component")
  })

  it("detects deleting 1 class and adding 1 unrelated class as DELETE + ADD, NOT a rename", () => {
    const before: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [],
      classes: [
        {
          id: "Invoice",
          name: "Invoice",
          description: "Billing document",
        },
      ],
      attributes: [
        {
          id: "Invoice.amount",
          class_id: "Invoice",
          name: "amount",
          data_type: "xsd:decimal",
        },
      ],
      relations: [],
      relation_attributes: [],
    }

    const after: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [],
      classes: [
        {
          id: "Vehicle",
          name: "Vehicle",
          description: "Motorized transport",
        },
      ],
      attributes: [
        {
          id: "Vehicle.vin",
          class_id: "Vehicle",
          name: "vin",
          data_type: "xsd:string",
        },
      ],
      relations: [],
      relation_attributes: [],
    }

    const diff = diffLinkmlSnapshots(before, after)

    assert.equal(
      diff.renamedClasses.length,
      0,
      "Must NOT detect unrelated class as rename"
    )
    assert.equal(diff.deletedClasses.length, 1)
    assert.equal(diff.deletedClasses[0], "Invoice")
    assert.equal(diff.addedClasses.length, 1)
    assert.equal(diff.addedClasses[0], "Vehicle")
  })

  it("detects renamed relation (works_for -> employed_by)", () => {
    const before: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [
        { id: "Person", name: "Person" },
        { id: "Organization", name: "Organization" },
      ],
      attributes: [],
      relations: [
        {
          id: "works_for",
          name: "works_for",
          domain_class_id: "Person",
          range_class_id: "Organization",
          description: "Employment",
        },
      ],
      relation_attributes: [],
    }

    const after: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [
        { id: "Person", name: "Person" },
        { id: "Organization", name: "Organization" },
      ],
      attributes: [],
      relations: [
        {
          id: "employed_by",
          name: "employed_by",
          domain_class_id: "Person",
          range_class_id: "Organization",
          description: "Employment",
        },
      ],
      relation_attributes: [],
    }

    const diff = diffLinkmlSnapshots(before, after)

    assert.equal(diff.renamedRelations.length, 1)
    assert.deepEqual(diff.renamedRelations[0], {
      oldKey: "works_for",
      newKey: "employed_by",
    })
  })

  it("detects renamed attribute (Person.age -> Person.years_old)", () => {
    const before: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [{ id: "Person", name: "Person" }],
      attributes: [
        {
          id: "Person.age",
          class_id: "Person",
          name: "age",
          data_type: "xsd:integer",
        },
      ],
      relations: [],
      relation_attributes: [],
    }

    const after: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [{ id: "Person", name: "Person" }],
      attributes: [
        {
          id: "Person.years_old",
          class_id: "Person",
          name: "years_old",
          data_type: "xsd:integer",
        },
      ],
      relations: [],
      relation_attributes: [],
    }

    const diff = diffLinkmlSnapshots(before, after)

    assert.equal(diff.renamedAttributes.length, 1)
    assert.deepEqual(diff.renamedAttributes[0], {
      oldKey: "Person.age",
      newKey: "Person.years_old",
    })
  })

  it("detects renamed module (Core -> BaseDomain)", () => {
    const before: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [{ id: "Core", name: "Core", description: "Base domain" }],
      classes: [],
      attributes: [],
      relations: [],
      relation_attributes: [],
      ui_layout: {
        classPositions: {},
        moduleLayouts: {
          Core: { x: 10, y: 20, width: 200, height: 200 },
        },
      },
    }

    const after: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "Test" },
      modules: [
        { id: "BaseDomain", name: "BaseDomain", description: "Base domain" },
      ],
      classes: [],
      attributes: [],
      relations: [],
      relation_attributes: [],
      ui_layout: {
        classPositions: {},
        moduleLayouts: {
          BaseDomain: { x: 10, y: 20, width: 200, height: 200 },
        },
      },
    }

    const diff = diffLinkmlSnapshots(before, after)

    assert.equal(diff.renamedModules.length, 1)
    assert.deepEqual(diff.renamedModules[0], {
      oldKey: "Core",
      newKey: "BaseDomain",
    })
  })
})

describe("cascadeSymbolRename", () => {
  function createMockStore() {
    return {
      documentEntities: [
        {
          id: "ent-1",
          class_id: "Person" as string | null,
          extraction_run_id: "run-1",
          entity_text: "Alice",
        },
      ],
      entityAttributeValues: [
        {
          id: "eav-1",
          entity_id: "ent-1",
          attribute_id: "Person.age",
          value: "30",
        },
      ],
      facts: [
        {
          id: "fact-1",
          extraction_run_id: "run-1",
          relation_type_id: "works_for",
          subject_text: "Alice",
          relation_text: "works for",
          object_text: "Acme",
        },
      ],
      factRelationAttributeValues: [
        {
          id: "frav-1",
          fact_id: "fact-1",
          relation_attribute_id: "works_for.since",
          value: "2020",
        },
      ],
      ontologyCompetencyQuestions: [
        {
          id: "cq-1",
          ontology_id: "ont-1",
          module_id: "Core" as string | null,
          subject_class_id: "Person" as string | null,
          predicate_relation_id: "works_for" as string | null,
          object_class_id: "Organization" as string | null,
        },
      ],
      ontologyCqTriples: [
        {
          id: "trip-1",
          cq_id: "cq-1",
          subject_class_id: "Person" as string | null,
          predicate_relation_id: "works_for" as string | null,
          object_class_id: "Organization" as string | null,
        },
      ],
      ontologyCompetencyQuestionModules: [
        {
          cq_id: "cq-1",
          module_id: "Core",
        },
      ],
      datasetSources: [
        {
          id: "ds-1",
          ontology_id: "ont-1",
          mapping_spec: { targetClassId: "Person" },
        },
      ],
      extractionRuns: [
        {
          id: "run-1",
          ontology_id: "ont-1",
        },
      ],
    }
  }

  function createMockTx(
    store: ReturnType<typeof createMockStore>
  ): DbTransaction {
    return {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "extraction_runs") {
              return Promise.resolve(
                store.extractionRuns.map((r) => ({ id: r.id }))
              )
            }
            if (tableName === "document_entities") {
              return Promise.resolve(
                store.documentEntities.map((e) => ({ id: e.id }))
              )
            }
            if (tableName === "facts") {
              return Promise.resolve(store.facts.map((f) => ({ id: f.id })))
            }
            if (tableName === "ontology_competency_questions") {
              return Promise.resolve(
                store.ontologyCompetencyQuestions.map((q) => ({ id: q.id }))
              )
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "document_entities") {
              for (const ent of store.documentEntities) {
                if (values.class_id !== undefined) {
                  ent.class_id = values.class_id as string
                }
              }
            } else if (tableName === "entity_attribute_values") {
              for (const eav of store.entityAttributeValues) {
                if (typeof values.attribute_id === "string") {
                  eav.attribute_id = values.attribute_id
                } else if (values.attribute_id) {
                  eav.attribute_id = eav.attribute_id.replace(
                    /^Person\./,
                    "Individual."
                  )
                }
              }
            } else if (tableName === "facts") {
              for (const f of store.facts) {
                if (values.relation_type_id !== undefined) {
                  f.relation_type_id = values.relation_type_id as string
                }
              }
            } else if (tableName === "fact_relation_attribute_values") {
              for (const frav of store.factRelationAttributeValues) {
                if (typeof values.relation_attribute_id === "string") {
                  frav.relation_attribute_id = values.relation_attribute_id
                } else if (values.relation_attribute_id) {
                  frav.relation_attribute_id =
                    frav.relation_attribute_id.replace(
                      /^works_for\./,
                      "employed_by."
                    )
                }
              }
            } else if (tableName === "ontology_competency_questions") {
              for (const cq of store.ontologyCompetencyQuestions) {
                if (values.subject_class_id !== undefined) {
                  cq.subject_class_id = values.subject_class_id as string
                }
                if (values.object_class_id !== undefined) {
                  cq.object_class_id = values.object_class_id as string
                }
                if (values.predicate_relation_id !== undefined) {
                  cq.predicate_relation_id =
                    values.predicate_relation_id as string
                }
                if (values.module_id !== undefined) {
                  cq.module_id = values.module_id as string
                }
              }
            } else if (tableName === "ontology_cq_triples") {
              for (const trip of store.ontologyCqTriples) {
                if (values.subject_class_id !== undefined) {
                  trip.subject_class_id = values.subject_class_id as string
                }
                if (values.object_class_id !== undefined) {
                  trip.object_class_id = values.object_class_id as string
                }
                if (values.predicate_relation_id !== undefined) {
                  trip.predicate_relation_id =
                    values.predicate_relation_id as string
                }
              }
            } else if (tableName === "ontology_competency_question_modules") {
              for (const cqm of store.ontologyCompetencyQuestionModules) {
                if (values.module_id !== undefined) {
                  cqm.module_id = values.module_id as string
                }
              }
            } else if (tableName === "dataset_sources") {
              for (const ds of store.datasetSources) {
                if (values.mapping_spec !== undefined) {
                  ds.mapping_spec = { targetClassId: "Individual" }
                }
              }
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: () => {
          const tableName = getTableName(table)
          if (tableName === "facts") {
            store.facts = []
          } else if (tableName === "entity_attribute_values") {
            store.entityAttributeValues = []
          } else if (tableName === "fact_relation_attribute_values") {
            store.factRelationAttributeValues = []
          } else if (tableName === "ontology_competency_question_modules") {
            store.ontologyCompetencyQuestionModules = []
          }
          return Promise.resolve()
        },
      }),
    }
  }

  it("renaming class Person -> Individual updates document_entities.class_id AND updates entity_attribute_values.attribute_id prefix", async () => {
    const store = createMockStore()
    const mockTx = createMockTx(store)

    await cascadeSymbolRename(mockTx, "ont-1", "class", "Person", "Individual")

    assert.equal(store.documentEntities[0].class_id, "Individual")
    assert.equal(store.entityAttributeValues[0].attribute_id, "Individual.age")
    assert.equal(
      store.ontologyCompetencyQuestions[0].subject_class_id,
      "Individual"
    )
    assert.equal(store.ontologyCqTriples[0].subject_class_id, "Individual")
  })

  it("renaming relation works_for -> employed_by updates facts.relation_type_id and CQ triples predicate_relation_id", async () => {
    const store = createMockStore()
    const mockTx = createMockTx(store)

    await cascadeSymbolRename(
      mockTx,
      "ont-1",
      "relation",
      "works_for",
      "employed_by"
    )

    assert.equal(store.facts[0].relation_type_id, "employed_by")
    assert.equal(
      store.ontologyCompetencyQuestions[0].predicate_relation_id,
      "employed_by"
    )
    assert.equal(
      store.ontologyCqTriples[0].predicate_relation_id,
      "employed_by"
    )
  })
})

describe("cascadeSymbolDelete", () => {
  it("deleting class Person nulls out document_entities.class_id and deletes associated entity_attribute_values", async () => {
    const store = {
      documentEntities: [
        {
          id: "ent-1",
          class_id: "Person" as string | null,
          extraction_run_id: "run-1",
        },
      ],
      entityAttributeValues: [
        { id: "eav-1", entity_id: "ent-1", attribute_id: "Person.age" },
      ],
      facts: [],
      factRelationAttributeValues: [],
      ontologyCompetencyQuestions: [
        {
          id: "cq-1",
          ontology_id: "ont-1",
          subject_class_id: "Person" as string | null,
          object_class_id: "Organization" as string | null,
        },
      ],
      ontologyCqTriples: [
        {
          id: "trip-1",
          cq_id: "cq-1",
          subject_class_id: "Person" as string | null,
          object_class_id: "Organization" as string | null,
        },
      ],
      ontologyCompetencyQuestionModules: [],
      datasetSources: [],
      extractionRuns: [{ id: "run-1", ontology_id: "ont-1" }],
    }

    const mockTx: DbTransaction = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "extraction_runs") {
              return Promise.resolve(
                store.extractionRuns.map((r) => ({ id: r.id }))
              )
            }
            if (tableName === "document_entities") {
              return Promise.resolve(
                store.documentEntities.map((e) => ({ id: e.id }))
              )
            }
            if (tableName === "ontology_competency_questions") {
              return Promise.resolve(
                store.ontologyCompetencyQuestions.map((q) => ({ id: q.id }))
              )
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "document_entities") {
              store.documentEntities[0].class_id =
                (values.class_id as string | null) ?? null
            } else if (tableName === "ontology_competency_questions") {
              if ("subject_class_id" in values) {
                store.ontologyCompetencyQuestions[0].subject_class_id =
                  values.subject_class_id as string | null
              }
            } else if (tableName === "ontology_cq_triples") {
              if ("subject_class_id" in values) {
                store.ontologyCqTriples[0].subject_class_id =
                  values.subject_class_id as string | null
              }
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: () => {
          const tableName = getTableName(table)
          if (tableName === "entity_attribute_values") {
            store.entityAttributeValues = []
          }
          return Promise.resolve()
        },
      }),
    }

    await cascadeSymbolDelete(mockTx, "ont-1", "class", "Person")

    assert.equal(store.documentEntities[0].class_id, null)
    assert.equal(store.entityAttributeValues.length, 0)
    assert.equal(store.ontologyCompetencyQuestions[0].subject_class_id, null)
    assert.equal(store.ontologyCqTriples[0].subject_class_id, null)
  })

  it("deleting relation works_for removes matching facts and cleans CQ triple predicates", async () => {
    const store = {
      facts: [
        { id: "fact-1", relation_type_id: "works_for" },
        { id: "fact-2", relation_type_id: "other_rel" },
      ],
      factRelationAttributeValues: [],
      ontologyCompetencyQuestions: [
        {
          id: "cq-1",
          ontology_id: "ont-1",
          predicate_relation_id: "works_for" as string | null,
        },
      ],
      ontologyCqTriples: [
        {
          id: "trip-1",
          cq_id: "cq-1",
          predicate_relation_id: "works_for" as string | null,
        },
      ],
      extractionRuns: [{ id: "run-1", ontology_id: "ont-1" }],
    }

    const mockTx: DbTransaction = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "extraction_runs") {
              return Promise.resolve(
                store.extractionRuns.map((r) => ({ id: r.id }))
              )
            }
            if (tableName === "facts") {
              return Promise.resolve(store.facts.map((f) => ({ id: f.id })))
            }
            if (tableName === "ontology_competency_questions") {
              return Promise.resolve(
                store.ontologyCompetencyQuestions.map((q) => ({ id: q.id }))
              )
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "ontology_competency_questions") {
              if ("predicate_relation_id" in values) {
                store.ontologyCompetencyQuestions[0].predicate_relation_id =
                  values.predicate_relation_id as string | null
              }
            } else if (tableName === "ontology_cq_triples") {
              if ("predicate_relation_id" in values) {
                store.ontologyCqTriples[0].predicate_relation_id =
                  values.predicate_relation_id as string | null
              }
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: () => {
          const tableName = getTableName(table)
          if (tableName === "facts") {
            store.facts = store.facts.filter(
              (f) => f.relation_type_id !== "works_for"
            )
          }
          return Promise.resolve()
        },
      }),
    }

    await cascadeSymbolDelete(mockTx, "ont-1", "relation", "works_for")

    assert.equal(store.facts.length, 1)
    assert.equal(store.facts[0].id, "fact-2")
    assert.equal(
      store.ontologyCompetencyQuestions[0].predicate_relation_id,
      null
    )
    assert.equal(store.ontologyCqTriples[0].predicate_relation_id, null)
  })
})

describe("Multi-Ontology Scoping & Data Isolation", () => {
  it("operations on an ontology with 0 extraction runs or CQs do NOT mutate or delete records of other ontologies", async () => {
    const otherStore = {
      documentEntities: [
        { id: "ent-2", class_id: "Person", extraction_run_id: "run-2" },
      ],
      entityAttributeValues: [
        {
          id: "eav-2",
          entity_id: "ent-2",
          attribute_id: "Person.age",
          value: "25",
        },
      ],
      facts: [
        {
          id: "fact-2",
          relation_type_id: "works_for",
          extraction_run_id: "run-2",
        },
      ],
      factRelationAttributeValues: [
        {
          id: "frav-2",
          fact_id: "fact-2",
          relation_attribute_id: "works_for.since",
          value: "2021",
        },
      ],
      ontologyCompetencyQuestions: [
        {
          id: "cq-2",
          ontology_id: "ont-2",
          module_id: "Core",
          subject_class_id: "Person",
          predicate_relation_id: "works_for",
          object_class_id: "Organization",
        },
      ],
      ontologyCqTriples: [
        {
          id: "trip-2",
          cq_id: "cq-2",
          subject_class_id: "Person",
          predicate_relation_id: "works_for",
          object_class_id: "Organization",
        },
      ],
      ontologyCompetencyQuestionModules: [{ cq_id: "cq-2", module_id: "Core" }],
      extractionRuns: [{ id: "run-2", ontology_id: "ont-2" }],
    }

    // MockTx queries scoped to ont-1: returns 0 runs and 0 CQs for ont-1
    const mockTx: DbTransaction = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "extraction_runs") {
              return Promise.resolve([])
            }
            if (tableName === "ontology_competency_questions") {
              return Promise.resolve([])
            }
            if (tableName === "document_entities") {
              return Promise.resolve([])
            }
            if (tableName === "facts") {
              return Promise.resolve([])
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => {
            assert.fail(
              "Should not execute update for ontology with 0 runs/CQs"
            )
          },
        }),
      }),
      delete: () => ({
        where: () => {
          assert.fail("Should not execute delete for ontology with 0 runs/CQs")
        },
      }),
    }

    // Attempt renames on ont-1 (with 0 runs and 0 CQs)
    await cascadeSymbolRename(mockTx, "ont-1", "class", "Person", "Individual")
    await cascadeSymbolRename(
      mockTx,
      "ont-1",
      "relation",
      "works_for",
      "employed_by"
    )
    await cascadeSymbolRename(
      mockTx,
      "ont-1",
      "attribute",
      "Person.age",
      "Person.years_old"
    )
    await cascadeSymbolRename(mockTx, "ont-1", "module", "Core", "BaseDomain")

    // Attempt deletes on ont-1
    await cascadeSymbolDelete(mockTx, "ont-1", "class", "Person")
    await cascadeSymbolDelete(mockTx, "ont-1", "relation", "works_for")
    await cascadeSymbolDelete(mockTx, "ont-1", "attribute", "Person.age")
    await cascadeSymbolDelete(mockTx, "ont-1", "module", "Core")

    // Verify other ontology's data is 100% untouched
    assert.equal(otherStore.documentEntities[0].class_id, "Person")
    assert.equal(otherStore.entityAttributeValues[0].attribute_id, "Person.age")
    assert.equal(otherStore.facts[0].relation_type_id, "works_for")
    assert.equal(
      otherStore.ontologyCompetencyQuestions[0].subject_class_id,
      "Person"
    )
    assert.equal(otherStore.ontologyCqTriples[0].subject_class_id, "Person")
  })
})

describe("loadCanonicalOntology and saveCanonicalOntology", () => {
  it("loadCanonicalOntology loads canonical snapshot from ontology_documents row", async () => {
    const rawYaml = `
id: https://kg-workbench.local/ontology/ont-1#
name: TestOntology
classes:
  Person:
    description: Human being
`
    const mockLayout: OntologyUiLayout = {
      classPositions: { Core: { Person: { x: 10, y: 20 } } },
      moduleLayouts: {},
    }

    const mockDb: DbClient = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                id: "ont-1",
                name: "TestOntology",
                version: "1.0.0",
                linkml_yaml: rawYaml,
                ui_layout: mockLayout,
              },
            ]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    }

    const snapshot = await loadCanonicalOntology("ont-1", mockDb)

    assert.equal(snapshot.document.id, "ont-1")
    assert.equal(snapshot.document.name, "TestOntology")
    assert.equal(snapshot.classes.length, 1)
    assert.equal(snapshot.classes[0].id, "Person")
    assert.deepEqual(snapshot.ui_layout, mockLayout)
  })

  it("loadCanonicalOntology returns default minimal snapshot if linkml_yaml is empty", async () => {
    const mockDb: DbClient = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                id: "ont-empty",
                name: "EmptyDoc",
                version: "1.0.0",
                linkml_yaml: "",
                ui_layout: { classPositions: {}, moduleLayouts: {} },
              },
            ]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    }

    const snapshot = await loadCanonicalOntology("ont-empty", mockDb)

    assert.equal(snapshot.document.id, "ont-empty")
    assert.equal(snapshot.classes.length, 0)
    assert.equal(snapshot.modules.length, 0)
    assert.equal(snapshot.relations.length, 0)
  })

  it("saveCanonicalOntology mutates snapshot inside transaction, runs cascades, updates YAML and artifacts", async () => {
    let savedRow: Record<string, unknown> | null = null

    const initialSnapshot: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "OrgModel" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [{ id: "Person", name: "Person" }],
      attributes: [
        {
          id: "Person.age",
          class_id: "Person",
          name: "age",
          data_type: "xsd:integer",
        },
      ],
      relations: [],
      relation_attributes: [],
      ui_layout: {
        classPositions: { Core: { Person: { x: 50, y: 50 } } },
        moduleLayouts: {},
      },
    }
    const initialYaml = snapshotToLinkmlYaml(initialSnapshot)

    const mockDb: DbClient = {
      transaction: async <T>(cb: (tx: DbTransaction) => Promise<T>) => {
        return cb(mockDb)
      },
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "ontology_documents") {
              return Promise.resolve([
                {
                  id: "ont-1",
                  name: "OrgModel",
                  version: "1.0.0",
                  linkml_yaml: initialYaml,
                  ui_layout: initialSnapshot.ui_layout,
                },
              ])
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "ontology_documents") {
              savedRow = values
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    }

    const updated = await saveCanonicalOntology(
      "ont-1",
      (draft) => {
        draft.classes[0].id = "Individual"
        draft.classes[0].name = "Individual"
        draft.attributes[0].id = "Individual.age"
        draft.attributes[0].class_id = "Individual"
        if (draft.ui_layout?.classPositions.Core) {
          draft.ui_layout.classPositions.Core.Individual =
            draft.ui_layout.classPositions.Core.Person
          delete draft.ui_layout.classPositions.Core.Person
        }
      },
      { db: mockDb }
    )

    assert.equal(updated.classes[0].id, "Individual")
    assert.ok(savedRow, "Must save updated row")
    assert.ok(
      typeof (savedRow as Record<string, unknown>).linkml_yaml === "string" &&
        ((savedRow as Record<string, unknown>).linkml_yaml as string).includes(
          "Individual:"
        ),
      "Saved YAML must contain renamed class Individual"
    )
    assert.ok(
      (savedRow as Record<string, unknown>).compiled_artifacts !== undefined,
      "Must populate compiled_artifacts"
    )
  })

  it("saveCanonicalOntology handles mutator returning a replacement draft", async () => {
    let savedRow: Record<string, unknown> | null = null

    const initialSnapshot: CanonicalOntologySnapshot = {
      document: { id: "ont-1", name: "OrgModel" },
      modules: [{ id: "Core", name: "Core" }],
      classes: [{ id: "Person", name: "Person" }],
      attributes: [],
      relations: [],
      relation_attributes: [],
    }
    const initialYaml = snapshotToLinkmlYaml(initialSnapshot)

    const mockDb: DbClient = {
      transaction: async <T>(cb: (tx: DbTransaction) => Promise<T>) => {
        return cb(mockDb)
      },
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "ontology_documents") {
              return Promise.resolve([
                {
                  id: "ont-1",
                  name: "OrgModel",
                  version: "1.0.0",
                  linkml_yaml: initialYaml,
                  ui_layout: { classPositions: {}, moduleLayouts: {} },
                },
              ])
            }
            return Promise.resolve([])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            const tableName = getTableName(table)
            if (tableName === "ontology_documents") {
              savedRow = values
            }
            return Promise.resolve()
          },
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    }

    const updated = await saveCanonicalOntology(
      "ont-1",
      (draft) => {
        return {
          ...draft,
          classes: [{ id: "Human", name: "Human" }],
        }
      },
      { db: mockDb }
    )

    assert.equal(updated.classes[0].id, "Human")
    assert.ok(savedRow, "Must save updated row")
    const yaml = (savedRow as unknown as Record<string, unknown>).linkml_yaml
    assert.ok(typeof yaml === "string" && yaml.includes("Human:"))
  })
})
