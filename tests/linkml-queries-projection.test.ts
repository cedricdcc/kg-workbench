import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import {
  getOntologyClass,
  getOntologyClassById,
  getOntologyClasses,
  getOntologyClassesByModule,
} from "../src/features/ontology/server/queries/classes"
import {
  getOntologyRelation,
  getOntologyRelationById,
  getOntologyRelations,
  getOntologyRelationsByModule,
} from "../src/features/ontology/server/queries/relations"
import { getOntologyModules } from "../src/features/ontology/server/queries/modules"
import {
  getClassPositions,
  getModuleLayouts,
  getOntologyLayout,
} from "../src/features/ontology/server/queries/layout"
import { getOntologyLanguages } from "../src/features/ontology/server/queries/languages"
import {
  getOntologyExamples,
  getOntologyExamplesByOntology,
  getInstanceCandidateExamples,
  getOntologyLocalizedTexts,
  getOntologyLocalizedTextsByOntology,
  getOntologyNotes,
  getOntologyNotesByOntology,
} from "../src/features/ontology/server/queries/metadata"
import {
  getRelationAttributes,
  getRelationAttributesByOntology,
} from "../src/features/ontology/server/queries/relation-attributes"
import {
  getBlastRadiusData,
  getClassBlastRadius,
  getRelationBlastRadius,
} from "../src/features/ontology/server/blast-radius/queries"
import {
  fetchOntologyForDocument,
  getOntologyForDocument,
} from "../src/features/documents/server/queries/ontology"
import type { OntologyUiLayout } from "../src/features/ontology/server/linkml/types"

const SAMPLE_LINKML_YAML = `
id: https://kg-workbench.local/ontology/test-queries#
name: TestQueriesOntology
version: 1.0.0
in_language: en
description: Test ontology for LinkML query projections

subsets:
  core:
    description: Core domain module
    annotations:
      kg_name: Core Module
  analytics:
    description: Analytics module
    annotations:
      kg_name: Analytics Module

classes:
  Person:
    description: A human individual
    in_subset:
      - core
    annotations:
      kg_notes:
        - body: Test note on Person
          author_name: Alice
      kg_localized_texts:
        - field_name: name
          language_code: de
          value: Mensch
      kg_examples:
        - value: John Doe
          is_instance_candidate: true
    attributes:
      name:
        range: string
        required: true
        description: Full name of person
      age:
        range: integer
        required: false
        description: Age in years
  Employee:
    description: An employed person
    is_a: Person
    in_subset:
      - core
    attributes:
      employee_id:
        range: string
        required: true
        description: Company ID
  Department:
    description: An organizational department
    in_subset:
      - analytics
    attributes:
      dept_name:
        range: string
        required: true
        description: Department title

slots:
  works_in:
    domain: Employee
    range: Department
    description: Department where the employee works
    multivalued: false
    annotations:
      kg_relation_id: works_in
      kg_display_name: works_in
      kg_cardinality: many-to-one
      kg_relation_attributes:
        - name: start_date
          data_type: string
          required: true
          description: Date employee joined department
          sort_order: 1
`

const SAMPLE_UI_LAYOUT: OntologyUiLayout = {
  classPositions: {
    core: {
      Person: { x: 100, y: 120 },
      Employee: { x: 100, y: 250 },
    },
    analytics: {
      Department: { x: 400, y: 200 },
    },
  },
  moduleLayouts: {
    core: { x: 50, y: 50, width: 300, height: 400 },
    analytics: { x: 380, y: 50, width: 300, height: 400 },
  },
}

const ONTOLOGY_ID = "00000000-0000-0000-0000-000000000001"
const DOCUMENT_ID = "00000000-0000-0000-0000-000000000002"

function getTableName(table: unknown): string {
  const obj = table as { [key: symbol]: string; _?: { name?: string } }
  return obj[Symbol.for("drizzle:Name")] || obj._?.name || ""
}

// In-memory test store
const store = {
  documents: [
    {
      id: DOCUMENT_ID,
      group_key: "shared",
      title: "Test Document",
    },
  ],
  ontology_documents: [
    {
      id: ONTOLOGY_ID,
      name: "TestQueriesOntology",
      version: "1.0.0",
      default_language: "en",
      usecase: "Testing LinkML queries projection",
      group_key: "shared",
      linkml_yaml: SAMPLE_LINKML_YAML,
      ohi_yaml: "",
      ohi_lockfile: null,
      ui_layout: SAMPLE_UI_LAYOUT,
      compiled_artifacts: null,
      source_file: null,
      created_at: new Date().toISOString(),
    },
  ],
  extraction_runs: [
    {
      id: "run-1",
      document_id: DOCUMENT_ID,
      ontology_id: ONTOLOGY_ID,
      completed_at: new Date().toISOString(),
    },
  ],
  document_entities: [
    {
      id: "ent-1",
      document_id: DOCUMENT_ID,
      class_id: "Person",
      entity_text: "Alice",
    },
    {
      id: "ent-2",
      document_id: DOCUMENT_ID,
      class_id: "Person",
      entity_text: "Bob",
    },
    {
      id: "ent-3",
      document_id: DOCUMENT_ID,
      class_id: "Employee",
      entity_text: "Charlie",
    },
  ],
  facts: [
    {
      id: "fact-1",
      document_id: DOCUMENT_ID,
      subject_entity_id: "ent-3",
      object_entity_id: "ent-4",
      relation_type_id: "works_in",
    },
    {
      id: "fact-2",
      document_id: DOCUMENT_ID,
      subject_entity_id: "ent-1",
      object_entity_id: "ent-2",
      relation_type_id: "knows",
    },
  ],
  ontology_competency_questions: [] as Array<Record<string, unknown>>,
  ontology_cq_triples: [] as Array<Record<string, unknown>>,
  ontology_competency_question_modules: [] as Array<Record<string, unknown>>,
}

type QueryChunk = {
  name?: string
  value?: string | string[]
  queryChunks?: QueryChunk[]
  constructor?: { name?: string }
}

type SqlCondition = {
  queryChunks?: QueryChunk[]
}

function evaluateCondition(
  row: Record<string, unknown>,
  cond: SqlCondition | null | undefined
): boolean {
  if (!cond) return true
  if (!cond.queryChunks) return true

  // Flatten single-child wrapper SQL: [ '(', inner, ')' ]
  if (cond.queryChunks.length === 3 && cond.queryChunks[1]?.queryChunks) {
    return evaluateCondition(row, cond.queryChunks[1])
  }

  // Check if queryChunks contains AND or OR string chunks
  let hasAnd = false
  let hasOr = false
  for (const c of cond.queryChunks) {
    const val = Array.isArray(c?.value) ? c.value.join("") : c?.value
    if (typeof val === "string") {
      if (val.toLowerCase().includes(" and ")) hasAnd = true
      if (val.toLowerCase().includes(" or ")) hasOr = true
    }
  }

  if (hasOr) {
    const subs = cond.queryChunks.filter((c) => Boolean(c && c.queryChunks))
    return subs.some((s) => evaluateCondition(row, s))
  }
  if (hasAnd) {
    const subs = cond.queryChunks.filter((c) => Boolean(c && c.queryChunks))
    return subs.every((s) => evaluateCondition(row, s))
  }

  // Otherwise leaf comparison
  let colName: string | null = null
  let targetVal: unknown = undefined

  function traverse(item: QueryChunk | unknown) {
    if (!item) return
    if (
      typeof item === "object" &&
      "name" in item &&
      typeof (item as { name: unknown }).name === "string"
    ) {
      colName = (item as { name: string }).name
      return
    }
    const chunkObj = item as QueryChunk
    if (chunkObj.queryChunks) {
      for (const child of chunkObj.queryChunks) traverse(child)
      return
    }
    if (chunkObj.constructor?.name === "StringChunk") return
    if (targetVal === undefined) targetVal = item
  }

  traverse(cond)

  if (!colName) return true
  const rowVal = row[colName]
  const actualTargetVal =
    targetVal && typeof targetVal === "object" && "value" in targetVal
      ? (targetVal as { value: unknown }).value
      : targetVal

  if (Array.isArray(actualTargetVal)) {
    const unwrappedArray = actualTargetVal.map((v: unknown) =>
      v && typeof v === "object" && "value" in v
        ? (v as { value: unknown }).value
        : v
    )
    return unwrappedArray.includes(rowVal)
  }
  return rowVal === actualTargetVal
}

function createQueryMock() {
  const mockDb = {
    select: () => {
      let currentTable = ""
      let currentCondition: SqlCondition | null = null
      const queryObj = {
        from: (table: unknown) => {
          currentTable = getTableName(table)
          return queryObj
        },
        where: (condition: unknown) => {
          currentCondition = condition as SqlCondition
          return queryObj
        },
        orderBy: () => queryObj,
        limit: () => queryObj,
        innerJoin: () => queryObj,
        leftJoin: () => queryObj,
        then: <TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => {
          const tableRows =
            (store as Record<string, Array<Record<string, unknown>>>)[
              currentTable
            ] ?? []
          const rows = tableRows.filter((r) =>
            evaluateCondition(r, currentCondition)
          )
          return Promise.resolve(rows).then(onfulfilled, onrejected)
        },
      }
      return queryObj
    },
  }
  return mockDb
}

describe("LinkML Queries Projection (Slice 3.3)", () => {
  let prevDrizzle: unknown

  before(() => {
    const g = globalThis as unknown as { kgWorkbenchDrizzle: unknown }
    prevDrizzle = g.kgWorkbenchDrizzle
    g.kgWorkbenchDrizzle = createQueryMock()
  })

  after(() => {
    const g = globalThis as unknown as { kgWorkbenchDrizzle: unknown }
    g.kgWorkbenchDrizzle = prevDrizzle
  })

  describe("Ontology Classes Projection", () => {
    it("getOntologyClasses projects pure DTOs from linkml_yaml sorted by name", async () => {
      const classes = await getOntologyClasses(ONTOLOGY_ID)
      assert.equal(classes.length, 3)

      const names = classes.map((c) => c.name)
      assert.deepEqual(names, ["Department", "Employee", "Person"])

      const person = classes.find((c) => c.id === "Person")!
      assert.equal(person.id, "Person")
      assert.equal(person.ontology_id, ONTOLOGY_ID)
      assert.equal(person.module_id, "core")
      assert.equal(person.description, "A human individual")
      assert.equal(person.parent_class_id, null)
      assert.equal(person.instance_policy, "open")

      // Check attributes on Person
      assert.equal(person.attributes.length, 2)
      const attrNames = person.attributes.map((a) => a.name)
      assert.deepEqual(attrNames, ["age", "name"])
      const nameAttr = person.attributes.find((a) => a.name === "name")!
      assert.equal(nameAttr.id, "Person.name")
      assert.equal(nameAttr.class_id, "Person")
      assert.equal(nameAttr.data_type, "string")
      assert.equal(nameAttr.required, true)

      // Check Employee inherits is_a Person
      const employee = classes.find((c) => c.id === "Employee")!
      assert.equal(employee.parent_class_id, "Person")
      assert.equal(employee.module_id, "core")
    })

    it("getOntologyClassById and getOntologyClass fetch single class with attributes", async () => {
      const person1 = await getOntologyClassById(ONTOLOGY_ID, "Person")
      assert.equal(person1.id, "Person")
      assert.equal(person1.name, "Person")
      assert.equal(person1.attributes.length, 2)

      const person2 = await getOntologyClass("Person")
      assert.equal(person2.id, "Person")
      assert.equal(person2.name, "Person")
    })

    it("getOntologyClassesByModule filters classes by subset", async () => {
      const coreClasses = await getOntologyClassesByModule("core")
      assert.equal(coreClasses.length, 2)
      assert.deepEqual(
        coreClasses.map((c) => c.name),
        ["Employee", "Person"]
      )

      const analyticsClasses = await getOntologyClassesByModule("analytics")
      assert.equal(analyticsClasses.length, 1)
      assert.equal(analyticsClasses[0].name, "Department")
    })
  })

  describe("Ontology Relations Projection", () => {
    it("getOntologyRelations projects relations from LinkML slots", async () => {
      const relations = await getOntologyRelations(ONTOLOGY_ID)
      assert.equal(relations.length, 1)

      const rel = relations[0]
      assert.equal(rel.id, "works_in")
      assert.equal(rel.name, "works_in")
      assert.equal(rel.ontology_id, ONTOLOGY_ID)
      assert.equal(rel.domain_class_id, "Employee")
      assert.equal(rel.range_class_id, "Department")
      assert.equal(rel.description, "Department where the employee works")
      assert.equal(rel.cardinality, "many-to-one")
    })

    it("getOntologyRelationById and getOntologyRelation fetch single relation", async () => {
      const rel1 = await getOntologyRelationById(ONTOLOGY_ID, "works_in")
      assert.equal(rel1.id, "works_in")
      assert.equal(rel1.name, "works_in")

      const rel2 = await getOntologyRelation("works_in")
      assert.equal(rel2.id, "works_in")
    })

    it("getOntologyRelationsByModule finds relations incident to module classes", async () => {
      const coreRelations = await getOntologyRelationsByModule(
        ONTOLOGY_ID,
        "core"
      )
      assert.equal(coreRelations.length, 1)
      assert.equal(coreRelations[0].name, "works_in")

      const emptyRelations = await getOntologyRelationsByModule(
        ONTOLOGY_ID,
        "non-existent"
      )
      assert.equal(emptyRelations.length, 0)
    })
  })

  describe("Ontology Modules Projection", () => {
    it("getOntologyModules projects subsets from LinkML schema", async () => {
      const modules = await getOntologyModules(ONTOLOGY_ID)
      assert.equal(modules.length, 2)

      const names = modules.map((m) => m.name)
      assert.deepEqual(names, ["Analytics Module", "Core Module"])

      const core = modules.find((m) => m.id === "core")!
      assert.equal(core.name, "Core Module")
      assert.equal(core.description, "Core domain module")
      assert.equal(core.ontology_id, ONTOLOGY_ID)
    })
  })

  describe("Ontology Visual Layout Projection", () => {
    it("getOntologyLayout, getClassPositions, and getModuleLayouts return ui_layout json", async () => {
      const layout = await getOntologyLayout(ONTOLOGY_ID)
      assert.deepEqual(layout.classPositions, SAMPLE_UI_LAYOUT.classPositions)
      assert.deepEqual(layout.moduleLayouts, SAMPLE_UI_LAYOUT.moduleLayouts)

      const positions = await getClassPositions(ONTOLOGY_ID)
      assert.deepEqual(positions, SAMPLE_UI_LAYOUT.classPositions)

      const moduleLayouts = await getModuleLayouts(ONTOLOGY_ID)
      assert.deepEqual(moduleLayouts, SAMPLE_UI_LAYOUT.moduleLayouts)
    })
  })

  describe("Ontology Languages Projection", () => {
    it("getOntologyLanguages returns default and localized text languages", async () => {
      const languages = await getOntologyLanguages(ONTOLOGY_ID)
      assert.equal(languages.length, 2)
      assert.deepEqual(
        languages.map((l) => l.language_code),
        ["de", "en"]
      )
      const de = languages.find((l) => l.language_code === "de")!
      assert.equal(de.label, "German")
    })
  })

  describe("Ontology Metadata Projection (Notes, Localized Texts, Examples)", () => {
    it("getOntologyNotesByOntology and getOntologyNotes return notes", async () => {
      const allNotes = await getOntologyNotesByOntology(ONTOLOGY_ID)
      assert.equal(allNotes.length, 1)
      assert.equal(allNotes[0].body, "Test note on Person")
      assert.equal(allNotes[0].author_name, "Alice")
      assert.equal(allNotes[0].target_class_id, "Person")

      const targetNotes = await getOntologyNotes({
        type: "class",
        id: "Person",
      })
      assert.equal(targetNotes.length, 1)
      assert.equal(targetNotes[0].body, "Test note on Person")
    })

    it("getOntologyLocalizedTextsByOntology and getOntologyLocalizedTexts return localized texts", async () => {
      const allTexts = await getOntologyLocalizedTextsByOntology(ONTOLOGY_ID)
      assert.equal(allTexts.length, 1)
      assert.equal(allTexts[0].field_name, "name")
      assert.equal(allTexts[0].language_code, "de")
      assert.equal(allTexts[0].value, "Mensch")

      const targetTexts = await getOntologyLocalizedTexts({
        type: "class",
        id: "Person",
      })
      assert.equal(targetTexts.length, 1)
      assert.equal(targetTexts[0].value, "Mensch")
    })

    it("getOntologyExamplesByOntology, getOntologyExamples, and getInstanceCandidateExamples return examples", async () => {
      const allExamples = await getOntologyExamplesByOntology(ONTOLOGY_ID)
      assert.equal(allExamples.length, 1)
      assert.equal(allExamples[0].value, "John Doe")
      assert.equal(allExamples[0].is_instance_candidate, true)

      const targetExamples = await getOntologyExamples({
        type: "class",
        id: "Person",
      })
      assert.equal(targetExamples.length, 1)
      assert.equal(targetExamples[0].value, "John Doe")

      const candidates = await getInstanceCandidateExamples({
        type: "class",
        id: "Person",
      })
      assert.equal(candidates.length, 1)
      assert.equal(candidates[0].value, "John Doe")
    })
  })

  describe("Relation Attributes Projection", () => {
    it("getRelationAttributes and getRelationAttributesByOntology read from LinkML slot annotations", async () => {
      const map = await getRelationAttributesByOntology(ONTOLOGY_ID)
      assert.ok(map["works_in"])
      assert.equal(map["works_in"].length, 1)
      assert.equal(map["works_in"][0].name, "start_date")
      assert.equal(map["works_in"][0].required, true)

      const list = await getRelationAttributes("works_in", ONTOLOGY_ID)
      assert.equal(list.length, 1)
      assert.equal(list[0].name, "start_date")
    })
  })

  describe("Blast Radius Calculation over LinkML Snapshot & Symbol Keys", () => {
    it("getClassBlastRadius computes subclasses, attributes, and affected document entities", async () => {
      const report = await getClassBlastRadius(ONTOLOGY_ID, "Person")

      assert.equal(report.targetId, "Person")
      assert.equal(report.targetType, "class")
      assert.equal(report.targetName, "Person")

      // Subclasses: Employee has is_a: Person
      assert.equal(report.details.subclasses.length, 1)
      assert.equal(report.details.subclasses[0].id, "Employee")

      // Attributes: Person has name, age
      assert.equal(report.details.attributes.length, 2)

      // Affected entities in document_entities with class_id: "Person" (ent-1, ent-2)
      assert.equal(report.summary.affectedEntitiesCount, 2)
      // Facts involving ent-1, ent-2 (fact-2)
      assert.equal(report.summary.affectedFactsCount, 1)
    })

    it("getRelationBlastRadius computes affected relation attributes and facts", async () => {
      const report = await getRelationBlastRadius(ONTOLOGY_ID, "works_in")

      assert.equal(report.targetId, "works_in")
      assert.equal(report.targetType, "relation")
      assert.equal(report.targetName, "works_in")

      // Relation attributes: start_date
      assert.equal(report.details.attributes.length, 1)
      assert.equal(report.details.attributes[0].name, "start_date")

      // Facts using relation_type_id: "works_in" (fact-1)
      assert.equal(report.summary.affectedFactsCount, 1)
    })

    it("getBlastRadiusData auto-routes to class or relation calculation", async () => {
      const classReport = await getBlastRadiusData(ONTOLOGY_ID, "Person")
      assert.equal(classReport.targetType, "class")
      assert.equal(classReport.targetId, "Person")

      const relReport = await getBlastRadiusData(ONTOLOGY_ID, "works_in")
      assert.equal(relReport.targetType, "relation")
      assert.equal(relReport.targetId, "works_in")
    })
  })

  describe("Document Ontology Query (getOntologyForDocument)", () => {
    it("getOntologyForDocument projects ontology from the extraction run's LinkML schema", async () => {
      const docOntology = await getOntologyForDocument(DOCUMENT_ID)

      assert.equal(docOntology.classes.length, 3)
      assert.deepEqual(
        docOntology.classes.map((c) => c.name),
        ["Department", "Employee", "Person"]
      )

      assert.equal(docOntology.relations.length, 1)
      assert.equal(docOntology.relations[0].name, "works_in")

      assert.equal(docOntology.modules.length, 2)

      // Check attributes
      assert.equal(docOntology.attributes.length, 4) // name, age, employee_id, dept_name

      // Check relation attributes
      assert.equal(docOntology.relationAttributes.length, 1)
      assert.equal(docOntology.relationAttributes[0].name, "start_date")

      // fetchOntologyForDocument should produce same
      const fetched = await fetchOntologyForDocument(DOCUMENT_ID)
      assert.equal(fetched.classes.length, 3)
    })
  })
})
