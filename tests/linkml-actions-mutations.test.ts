import assert from "node:assert/strict"
import { after, before, beforeEach, describe, it } from "node:test"

import type {
  CanonicalOntologySnapshot,
  OntologyUiLayout,
} from "../src/features/ontology/server/linkml/types"
import { snapshotToLinkmlYaml } from "../src/features/ontology/server/linkml/ast-mapper"
import { loadCanonicalOntology } from "../src/features/ontology/server/linkml/document-store"

import {
  createClass,
  updateClass,
  deleteClass,
  reconcileAndAdoptClass,
} from "../src/features/ontology/server/actions/classes"
import {
  addAttribute,
  updateAttribute,
  deleteAttribute,
} from "../src/features/ontology/server/actions/attributes"
import {
  createRelation,
  updateRelation,
  deleteRelation,
} from "../src/features/ontology/server/actions/relations"
import {
  createModule,
  updateModule,
  deleteModule,
} from "../src/features/ontology/server/actions/modules"
import {
  saveClassPosition,
  saveModuleLayout,
} from "../src/features/ontology/server/actions/layout"
import {
  refactorClassHierarchy,
  mergeClasses,
} from "../src/features/ontology/server/actions/class-refactoring"
import { applyOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"
import { commitDatasetMappingAction } from "../src/features/tabular/server/actions/commit-dataset-mapping"

function getTableName(table: unknown): string {
  const obj = table as { [key: symbol]: string; _?: { name?: string } }
  return obj[Symbol.for("drizzle:Name")] || obj._?.name || ""
}

const ONTOLOGY_ID = "11111111-1111-4111-8111-111111111111"
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222"
const CQ_ID = "33333333-3333-4333-8333-333333333333"

function createInitialSnapshot(): CanonicalOntologySnapshot {
  return {
    document: {
      id: ONTOLOGY_ID,
      name: "TestMutationsOntology",
      version: "1.0.0",
      default_language: "en",
      usecase: "Testing LinkML write actions and cascades",
      group_key: "shared",
    },
    modules: [
      { id: "core", name: "Core Module", description: "Core domain module" },
      { id: "analytics", name: "Analytics Module", description: "Analytics" },
    ],
    classes: [
      {
        id: "Person",
        name: "Person",
        description: "A human individual",
        module_id: "core",
        instance_policy: "open",
      },
      {
        id: "Company",
        name: "Company",
        description: "An enterprise or firm",
        module_id: "core",
        instance_policy: "open",
      },
    ],
    attributes: [
      {
        id: "Person.age",
        class_id: "Person",
        name: "age",
        data_type: "xsd:integer",
        required: false,
        description: "Age in years",
      },
      {
        id: "Company.revenue",
        class_id: "Company",
        name: "revenue",
        data_type: "xsd:decimal",
        required: false,
        description: "Annual revenue",
      },
    ],
    relations: [
      {
        id: "works_for",
        name: "works_for",
        domain_class_id: "Person",
        range_class_id: "Company",
        description: "Person works for Company",
        cardinality: "many-to-one",
        instance_policy: "open",
      },
    ],
    relation_attributes: [
      {
        id: "works_for.start_year",
        relation_id: "works_for",
        name: "start_year",
        data_type: "xsd:integer",
        required: true,
        sort_order: 1,
      },
    ],
    notes: [
      {
        id: "note-1",
        target_type: "class",
        target_id: "Person",
        body: "Initial note on Person",
        author_name: "Admin",
      },
    ],
    examples: [
      {
        id: "ex-1",
        target_type: "class",
        target_id: "Person",
        value: "Alice Doe",
        is_instance_candidate: true,
      },
    ],
    localized_texts: [
      {
        id: "lt-1",
        target_type: "class",
        target_id: "Person",
        field_name: "name",
        language_code: "de",
        value: "Person DE",
      },
    ],
    ui_layout: {
      classPositions: {
        core: {
          Person: { x: 100, y: 100 },
          Company: { x: 400, y: 100 },
        },
      },
      moduleLayouts: {
        core: { x: 50, y: 50, width: 600, height: 400 },
      },
    },
  }
}

type StoreData = {
  ontology_documents: Array<{
    id: string
    name: string
    version: string | null
    default_language: string
    usecase: string
    group_key: string
    linkml_yaml: string
    ohi_yaml: string
    ohi_lockfile: unknown
    ui_layout: OntologyUiLayout
    compiled_artifacts: unknown
    source_file: string | null
  }>
  extraction_runs: Array<{
    id: string
    ontology_id: string
    document_id: string
  }>
  document_entities: Array<{
    id: string
    extraction_run_id?: string
    document_id: string
    class_id: string | null
    entity_text: string
  }>
  facts: Array<{
    id: string
    extraction_run_id?: string
    document_id: string
    subject_entity_id: string
    object_entity_id: string
    relation_type_id: string | null
  }>
  entity_attribute_values: Array<{
    id: string
    entity_id: string
    attribute_id: string
    value: string
  }>
  fact_relation_attribute_values: Array<{
    id: string
    fact_id: string
    relation_attribute_id: string
    value: string
  }>
  ontology_competency_questions: Array<{
    id: string
    ontology_id: string
    module_id: string | null
    subject_class_id: string | null
    predicate_relation_id: string | null
    object_class_id: string | null
    question: string
    sort_order?: number
  }>
  ontology_cq_triples: Array<{
    id: string
    cq_id: string
    subject_class_id: string | null
    predicate_relation_id: string | null
    object_class_id: string | null
    sort_order?: number
  }>
  ontology_competency_question_modules: Array<{
    cq_id: string
    module_id: string
  }>
  dataset_sources: Array<{
    id: string
    ontology_id: string
    source_name: string
    mapping_spec: Record<string, unknown> | null
  }>
}

function createInitialStore(): StoreData {
  const snapshot = createInitialSnapshot()
  return {
    ontology_documents: [
      {
        id: ONTOLOGY_ID,
        name: "TestMutationsOntology",
        version: "1.0.0",
        default_language: "en",
        usecase: "Testing LinkML write actions and cascades",
        group_key: "shared",
        linkml_yaml: snapshotToLinkmlYaml(snapshot),
        ohi_yaml: "",
        ohi_lockfile: null,
        ui_layout: snapshot.ui_layout!,
        compiled_artifacts: null,
        source_file: null,
      },
    ],
    extraction_runs: [
      {
        id: "run-1",
        ontology_id: ONTOLOGY_ID,
        document_id: DOCUMENT_ID,
      },
    ],
    document_entities: [
      {
        id: "ent-1",
        extraction_run_id: "run-1",
        document_id: DOCUMENT_ID,
        class_id: "Person",
        entity_text: "Alice",
      },
      {
        id: "ent-2",
        extraction_run_id: "run-1",
        document_id: DOCUMENT_ID,
        class_id: "Company",
        entity_text: "Acme Corp",
      },
    ],
    facts: [
      {
        id: "fact-1",
        extraction_run_id: "run-1",
        document_id: DOCUMENT_ID,
        subject_entity_id: "ent-1",
        object_entity_id: "ent-2",
        relation_type_id: "works_for",
      },
    ],
    entity_attribute_values: [
      {
        id: "eav-1",
        entity_id: "ent-1",
        attribute_id: "Person.age",
        value: "30",
      },
    ],
    fact_relation_attribute_values: [
      {
        id: "frav-1",
        fact_id: "fact-1",
        relation_attribute_id: "works_for.start_year",
        value: "2020",
      },
    ],
    ontology_competency_questions: [
      {
        id: CQ_ID,
        ontology_id: ONTOLOGY_ID,
        module_id: "core",
        subject_class_id: "Person",
        predicate_relation_id: "works_for",
        object_class_id: "Company",
        question: "Where does Alice work?",
        sort_order: 1,
      },
    ],
    ontology_cq_triples: [
      {
        id: "triple-1",
        cq_id: CQ_ID,
        subject_class_id: "Person",
        predicate_relation_id: "works_for",
        object_class_id: "Company",
        sort_order: 1,
      },
    ],
    ontology_competency_question_modules: [
      {
        cq_id: CQ_ID,
        module_id: "core",
      },
    ],
    dataset_sources: [
      {
        id: "ds-1",
        ontology_id: ONTOLOGY_ID,
        source_name: "employees.csv",
        mapping_spec: null,
      },
    ],
  }
}

let store: StoreData

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
  if (typeof actualTargetVal === "string" && actualTargetVal.endsWith("%")) {
    const prefix = actualTargetVal.slice(0, -1)
    return typeof rowVal === "string" && rowVal.startsWith(prefix)
  }
  return rowVal === actualTargetVal
}

function createMockDb() {
  const dbExecutor = {
    select: () => {
      let tableName = ""
      let condition: SqlCondition | null = null
      const queryObj = {
        from: (table: unknown) => {
          tableName = getTableName(table)
          return queryObj
        },
        where: (cond: unknown) => {
          condition = cond as SqlCondition
          return queryObj
        },
        limit: () => queryObj,
        orderBy: () => queryObj,
        innerJoin: () => queryObj,
        leftJoin: () => queryObj,
        then: <TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            ((val: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?:
            ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) => {
          const list =
            (
              store as unknown as Record<string, Array<Record<string, unknown>>>
            )[tableName] ?? []
          const result = list.filter((r) => evaluateCondition(r, condition))
          return Promise.resolve(result).then(onfulfilled, onrejected)
        },
      }
      return queryObj
    },
    insert: (table: unknown) => {
      const tableName = getTableName(table)
      return {
        values: (valOrVals: unknown) => {
          const arr = Array.isArray(valOrVals) ? valOrVals : [valOrVals]
          const tableList =
            (store as unknown as Record<string, unknown[]>)[tableName] ?? []
          const inserted: unknown[] = []
          for (const item of arr) {
            const newItem = {
              id:
                (item as Record<string, unknown>).id ||
                `gen-${Math.random().toString(36).slice(2, 9)}`,
              ...(item as Record<string, unknown>),
            }
            tableList.push(newItem)
            inserted.push(newItem)
          }
          return {
            returning: () => Promise.resolve(inserted),
            onConflictDoNothing: () => Promise.resolve(inserted),
            onConflictDoUpdate: () => Promise.resolve(inserted),
            then: <TResult1 = unknown, TResult2 = never>(
              onfulfilled?:
                ((val: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
              onrejected?:
                ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) => Promise.resolve(inserted).then(onfulfilled, onrejected),
          }
        },
      }
    },
    update: (table: unknown) => {
      const tableName = getTableName(table)
      return {
        set: (vals: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const list =
              (store as unknown as Record<string, Record<string, unknown>[]>)[
                tableName
              ] ?? []
            const updatedRows: Record<string, unknown>[] = []
            for (const r of list) {
              if (evaluateCondition(r, cond as SqlCondition)) {
                for (const [k, v] of Object.entries(vals)) {
                  if (
                    v &&
                    typeof v === "object" &&
                    "queryChunks" in (v as Record<string, unknown>)
                  ) {
                    const chunks = (v as { queryChunks: unknown[] }).queryChunks
                    let newPrefix = ""
                    for (const chunk of chunks) {
                      const val =
                        chunk && typeof chunk === "object" && "value" in chunk
                          ? (chunk as { value: unknown }).value
                          : chunk
                      if (
                        typeof val === "string" &&
                        val.length > 0 &&
                        !val.includes("substring") &&
                        !val.includes("jsonb") &&
                        !val.includes("||")
                      ) {
                        newPrefix = val
                        break
                      }
                    }
                    if (newPrefix && typeof r[k] === "string") {
                      const parts = (r[k] as string).split(".")
                      if (parts.length > 1) {
                        r[k] = `${newPrefix}.${parts.slice(1).join(".")}`
                      }
                    }
                  } else {
                    r[k] = v
                  }
                }
                updatedRows.push(r)
              }
            }
            return {
              returning: () => Promise.resolve(updatedRows),
              then: <TResult1 = unknown, TResult2 = never>(
                onfulfilled?:
                  ((val: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
                onrejected?:
                  ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
              ) => Promise.resolve(updatedRows).then(onfulfilled, onrejected),
            }
          },
        }),
      }
    },
    delete: (table: unknown) => {
      const tableName = getTableName(table)
      return {
        where: (cond: unknown) => {
          const list =
            (store as unknown as Record<string, Record<string, unknown>[]>)[
              tableName
            ] ?? []
          const remaining: Record<string, unknown>[] = []
          for (const r of list) {
            if (!evaluateCondition(r, cond as SqlCondition)) {
              remaining.push(r)
            }
          }
          ;(store as unknown as Record<string, Record<string, unknown>[]>)[
            tableName
          ] = remaining
          return Promise.resolve()
        },
      }
    },
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
      return await cb(dbExecutor)
    },
  }
  return dbExecutor
}

describe("LinkML Actions Mutations & Cascades (Slice 3.4)", () => {
  let prevDrizzle: unknown

  before(() => {
    const g = globalThis as unknown as { kgWorkbenchDrizzle: unknown }
    prevDrizzle = g.kgWorkbenchDrizzle
    g.kgWorkbenchDrizzle = createMockDb()
  })

  after(() => {
    const g = globalThis as unknown as { kgWorkbenchDrizzle: unknown }
    g.kgWorkbenchDrizzle = prevDrizzle
  })

  beforeEach(() => {
    store = createInitialStore()
  })

  describe("Class CRUD & Cascades", () => {
    it("createClass adds a new class to canonical snapshot", async () => {
      const newClass = await createClass(ONTOLOGY_ID, "core", {
        name: "Department",
        description: "An organizational department",
      })

      assert.equal(newClass.name, "Department")
      assert.equal(newClass.module_id, "core")

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const found = snapshot.classes.find((c) => c.name === "Department")
      assert.ok(found, "Department class should exist in snapshot")
      assert.equal(found?.description, "An organizational department")
    })

    it("updateClass renames class and cascades rename to documentEntities, facts, and entityAttributeValues", async () => {
      await updateClass(
        "Person",
        {
          name: "Individual",
          description: "A renamed human individual",
        },
        ONTOLOGY_ID
      )

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const oldFound = snapshot.classes.find((c) => c.name === "Person")
      const newFound = snapshot.classes.find((c) => c.name === "Individual")
      assert.equal(oldFound, undefined, "Old class 'Person' should not exist")
      assert.ok(newFound, "New class 'Individual' should exist")
      assert.equal(newFound?.description, "A renamed human individual")

      // External table cascades
      const ent = store.document_entities.find((e) => e.id === "ent-1")
      assert.equal(
        ent?.class_id,
        "Individual",
        "document_entities.class_id must cascade to 'Individual'"
      )

      const eav = store.entity_attribute_values.find((a) => a.id === "eav-1")
      assert.equal(
        eav?.attribute_id,
        "Individual.age",
        "entity_attribute_values.attribute_id must prefix-match and cascade to 'Individual.age'"
      )
    })

    it("deleteClass removes class from canonical snapshot and nulls/cleans external references", async () => {
      await deleteClass("Person", ONTOLOGY_ID)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.classes.some((c) => c.id === "Person"),
        false
      )

      // External entities referencing Person should have class_id set to null
      const ent = store.document_entities.find((e) => e.id === "ent-1")
      assert.equal(
        ent?.class_id,
        null,
        "document_entities.class_id should be nulled out on class delete"
      )
    })
  })

  describe("Attribute CRUD & Cascades", () => {
    it("addAttribute adds a new slot/attribute to a class", async () => {
      const attr = await addAttribute(
        "Person",
        {
          name: "email",
          dataType: "xsd:string",
          required: true,
          description: "Email address",
        },
        ONTOLOGY_ID
      )

      assert.equal(attr.name, "email")
      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const found = snapshot.attributes.find(
        (a) => a.name === "email" && a.class_id === "Person"
      )
      assert.ok(found, "email attribute must be added to Person")
    })

    it("updateAttribute renames attribute and cascades to entityAttributeValues", async () => {
      await updateAttribute(
        "Person.age",
        {
          name: "years_of_age",
        },
        ONTOLOGY_ID
      )

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const oldFound = snapshot.attributes.find(
        (a) => a.name === "age" && a.class_id === "Person"
      )
      const newFound = snapshot.attributes.find(
        (a) => a.name === "years_of_age" && a.class_id === "Person"
      )
      assert.equal(oldFound, undefined)
      assert.ok(newFound, "years_of_age attribute should exist")

      const eav = store.entity_attribute_values.find((a) => a.id === "eav-1")
      assert.equal(
        eav?.attribute_id,
        "Person.years_of_age",
        "eav attribute_id should cascade to Person.years_of_age"
      )
    })

    it("deleteAttribute removes attribute from class and purges associated entity attribute values", async () => {
      await deleteAttribute("Person.age", ONTOLOGY_ID)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.attributes.some((a) => a.id === "Person.age"),
        false
      )

      const eav = store.entity_attribute_values.find((a) => a.id === "eav-1")
      assert.equal(
        eav,
        undefined,
        "eav associated with deleted attribute should be purged"
      )
    })
  })

  describe("Relation CRUD & Cascades", () => {
    it("createRelation adds a slot with domain and range", async () => {
      const rel = await createRelation(ONTOLOGY_ID, {
        name: "owns",
        domainClassId: "Person",
        rangeClassId: "Company",
        description: "Person owns Company",
      })

      assert.equal(rel.name, "owns")
      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const found = snapshot.relations.find((r) => r.name === "owns")
      assert.ok(found, "owns relation should be present")
      assert.equal(found?.domain_class_id, "Person")
      assert.equal(found?.range_class_id, "Company")
    })

    it("updateRelation renames relation and cascades to facts and CQ triples", async () => {
      await updateRelation(
        "works_for",
        {
          name: "employed_at",
        },
        ONTOLOGY_ID
      )

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.relations.some((r) => r.name === "works_for"),
        false
      )
      assert.ok(snapshot.relations.some((r) => r.name === "employed_at"))

      // External cascades
      const fact = store.facts.find((f) => f.id === "fact-1")
      assert.equal(
        fact?.relation_type_id,
        "employed_at",
        "fact.relation_type_id should cascade to employed_at"
      )

      const cq = store.ontology_competency_questions.find((q) => q.id === CQ_ID)
      assert.equal(
        cq?.predicate_relation_id,
        "employed_at",
        "cq predicate_relation_id should cascade to employed_at"
      )
    })

    it("deleteRelation removes relation and nulls out facts and CQ references", async () => {
      await deleteRelation("works_for", ONTOLOGY_ID)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.relations.some((r) => r.name === "works_for"),
        false
      )

      const fact = store.facts.find((f) => f.id === "fact-1")
      assert.equal(
        fact,
        undefined,
        "fact referencing deleted relation should be purged"
      )
      const cq = store.ontology_competency_questions.find((q) => q.id === CQ_ID)
      assert.equal(
        cq?.predicate_relation_id,
        null,
        "cq predicate_relation_id should be nulled"
      )
    })
  })

  describe("Module CRUD & Layout", () => {
    it("createModule adds module and updateModule renames module", async () => {
      const mod = await createModule({
        ontologyId: ONTOLOGY_ID,
        name: "Finance",
        description: "Finance concepts",
      })
      assert.equal(mod.name, "Finance")

      let snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.ok(snapshot.modules.some((m) => m.name === "Finance"))

      await updateModule("Finance", { name: "Corporate Finance" }, ONTOLOGY_ID)
      snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.ok(snapshot.modules.some((m) => m.name === "Corporate Finance"))
    })

    it("deleteModule removes module from snapshot", async () => {
      await deleteModule("analytics", ONTOLOGY_ID)
      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.modules.some((m) => m.id === "analytics"),
        false
      )
    })

    it("saveClassPosition and saveModuleLayout persist visual coordinates", async () => {
      await saveClassPosition(ONTOLOGY_ID, "Person", "core", 250, 350)
      await saveModuleLayout(ONTOLOGY_ID, "core", 80, 90, 700, 500)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.deepEqual(snapshot.ui_layout?.classPositions?.core?.Person, {
        x: 250,
        y: 350,
      })
      assert.deepEqual(snapshot.ui_layout?.moduleLayouts?.core, {
        x: 80,
        y: 90,
        width: 700,
        height: 500,
      })
    })
  })

  describe("Class Refactoring (Hierarchy & Merge)", () => {
    it("refactorClassHierarchy reparents class acyclically", async () => {
      await refactorClassHierarchy({
        ontologyId: ONTOLOGY_ID,
        classId: "Person",
        targetParentClassId: "Company",
      })

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const person = snapshot.classes.find((c) => c.name === "Person")
      assert.equal(person?.parent_class_id, "Company")
    })

    it("mergeClasses migrates relations and attributes to target class, then cascades delete of source class", async () => {
      const res = await mergeClasses({
        ontologyId: ONTOLOGY_ID,
        sourceClassId: "Person",
        targetClassId: "Company",
        retainedAttributeIds: ["Person.age"],
      })

      assert.equal(res.targetClassId, "Company")
      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.equal(
        snapshot.classes.some((c) => c.id === "Person"),
        false,
        "Source class Person deleted"
      )
      assert.ok(
        snapshot.classes.some((c) => c.id === "Company"),
        "Target class Company preserved"
      )

      // Retained attribute migrated
      const migratedAttr = snapshot.attributes.find(
        (a) => a.class_id === "Company" && a.name === "age"
      )
      assert.ok(migratedAttr, "Attribute age should be migrated to Company")

      // Relation domain updated
      const worksFor = snapshot.relations.find((r) => r.name === "works_for")
      assert.equal(
        worksFor?.domain_class_id,
        "Company",
        "works_for domain migrated to Company"
      )
    })

    it("reconcileAndAdoptClass adopts standard term and prunes unselected attributes", async () => {
      const res = await reconcileAndAdoptClass({
        ontologyId: ONTOLOGY_ID,
        classId: "Person",
        standardTerm: {
          curie: "schema:Person",
          label: "Person",
          description: "Standard schema.org Person",
        },
        retainedAttributeIds: ["Person.age"],
        relationDecisions: [
          {
            relationId: "works_for",
            action: "remap",
            remappedName: "employed_by",
            remappedDescription: "Remapped employment",
          },
        ],
      })

      assert.equal(res.classId, "Person")
      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const person = snapshot.classes.find((c) => c.id === "Person")
      assert.equal(person?.description, "Standard schema.org Person")

      const rel = snapshot.relations.find(
        (r) => r.id === "works_for" || r.name === "employed_by"
      )
      assert.equal(rel?.name, "employed_by")
    })
  })

  describe("Tabular Dataset Mapping Commit", () => {
    it("commitDatasetMappingAction synthesizes classes and attributes into LinkML snapshot", async () => {
      const result = await commitDatasetMappingAction({
        ontologyId: ONTOLOGY_ID,
        datasetSourceId: "ds-1",
        mappingSpec: {
          targetClassName: "Employee",
          primaryKeyColumn: "emp_id",
          columnMappings: [
            {
              columnName: "emp_id",
              inferredType: "string",
              targetKind: "attribute",
              targetAttributeName: "empId",
              targetDataType: "xsd:string",
              isPrimaryKey: true,
            },
          ],
          synthesizedElements: {
            classes: [
              {
                name: "Employee",
                description: "Synthesized from dataset",
              },
            ],
            attributes: [
              {
                className: "Employee",
                name: "empId",
                dataType: "xsd:string",
              },
            ],
            relations: [],
          },
        },
      })

      assert.equal(result.ok, true)
      assert.equal(result.createdClassesCount, 1)
      assert.equal(result.createdAttributesCount, 1)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      const empClass = snapshot.classes.find((c) => c.name === "Employee")
      assert.ok(
        empClass,
        "Employee class must be synthesized in LinkML snapshot"
      )

      const empAttr = snapshot.attributes.find(
        (a) => a.class_id === "Employee" && a.name === "empId"
      )
      assert.ok(
        empAttr,
        "empId attribute must be synthesized in LinkML snapshot"
      )

      const ds = store.dataset_sources.find((s) => s.id === "ds-1")
      assert.equal(ds?.mapping_spec?.targetClassName, "Employee")
    })
  })

  describe("AI Draft Application", () => {
    it("applyOntologyDraft applies classes, modules, relations, and CQ mappings with symbol keys", async () => {
      const result = await applyOntologyDraft(ONTOLOGY_ID, {
        modules: [{ name: "Operations", description: "Operational workflows" }],
        classes: [
          {
            name: "Facility",
            moduleName: "Operations",
            description: "Physical operational facility",
            attributes: [
              {
                name: "capacity",
                dataType: "xsd:integer",
                description: "Capacity",
              },
            ],
          },
        ],
        relations: [
          {
            name: "operates",
            domainClassName: "Company",
            rangeClassName: "Facility",
            description: "Company operates Facility",
          },
        ],
        cqMappings: [
          {
            cqId: CQ_ID,
            triples: [
              {
                subjectClassName: "Company",
                predicateRelationName: "operates",
                objectClassName: "Facility",
              },
            ],
            moduleNames: ["Operations"],
          },
        ],
      })

      assert.ok(result.createdClasses >= 1)
      assert.ok(result.createdModules >= 1)
      assert.ok(result.createdRelations >= 1)

      const snapshot = await loadCanonicalOntology(ONTOLOGY_ID)
      assert.ok(snapshot.modules.some((m) => m.name === "Operations"))
      assert.ok(snapshot.classes.some((c) => c.name === "Facility"))
      assert.ok(snapshot.relations.some((r) => r.name === "operates"))

      const cqTriple = store.ontology_cq_triples.find((t) => t.cq_id === CQ_ID)
      assert.equal(cqTriple?.subject_class_id, "Company")
      assert.equal(cqTriple?.predicate_relation_id, "operates")
      assert.equal(cqTriple?.object_class_id, "Facility")
    })
  })
})
