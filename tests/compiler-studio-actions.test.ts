import assert from "node:assert/strict"
import { after, before, beforeEach, describe, it } from "node:test"

import type {
  CanonicalOntologySnapshot,
  OhiLockfileV2,
  OntologyUiLayout,
} from "../src/features/ontology/server/linkml/types"
import { snapshotToLinkmlYaml } from "../src/features/ontology/server/linkml/ast-mapper"
import { loadCanonicalOntology } from "../src/features/ontology/server/linkml/document-store"
import {
  getCompiledOntologyStudioDataAction,
  saveRawLinkmlYamlAction,
} from "../src/features/ontology/server/actions/compiler-studio"

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
      name: "CompilerStudioTestOntology",
      version: "1.0.0",
      default_language: "en",
      usecase: "Testing LinkML Compiler Studio actions",
      group_key: "shared",
    },
    modules: [
      { id: "core", name: "Core Module", description: "Core domain module" },
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
    relation_attributes: [],
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

const SAMPLE_OHI_YAML = `schema_version: 1
dependencies:
  - package: w3c/prov-o@2013
    format: linkml-yaml
`

const SAMPLE_OHI_LOCKFILE: OhiLockfileV2 = {
  lock_version: 2,
  selections: [
    {
      ontology: "w3c/prov-o@2013",
      format: "linkml-yaml",
    },
  ],
  files: [
    {
      package_path: "w3c/prov-o@2013/prov.linkml.yaml",
      base_url: "https://ohi.dev/registry",
      url: "https://ohi.dev/registry/w3c/prov-o/2013/prov.linkml.yaml",
      format: "linkml-yaml",
      sha256: "a".repeat(64),
      ontology: "w3c/prov-o@2013",
    },
  ],
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
    ohi_lockfile: OhiLockfileV2 | null
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
        name: "CompilerStudioTestOntology",
        version: "1.0.0",
        default_language: "en",
        usecase: "Testing LinkML Compiler Studio actions",
        group_key: "shared",
        linkml_yaml: snapshotToLinkmlYaml(snapshot),
        ohi_yaml: SAMPLE_OHI_YAML,
        ohi_lockfile: SAMPLE_OHI_LOCKFILE,
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
    fact_relation_attribute_values: [],
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
    dataset_sources: [],
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

  if (cond.queryChunks.length === 3 && cond.queryChunks[1]?.queryChunks) {
    return evaluateCondition(row, cond.queryChunks[1])
  }

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
            | ((val: unknown[]) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
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
    update: (table: unknown) => {
      const tableName = getTableName(table)
      return {
        set: (values: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            const list =
              (
                store as unknown as Record<
                  string,
                  Array<Record<string, unknown>>
                >
              )[tableName] ?? []
            const condition = cond as SqlCondition
            for (const row of list) {
              if (evaluateCondition(row, condition)) {
                for (const [k, v] of Object.entries(values)) {
                  if (v && typeof v === "object" && "queryChunks" in v) {
                    continue
                  }
                  row[k] = v
                }
              }
            }
            return Promise.resolve([])
          },
        }),
      }
    },
    delete: (table: unknown) => {
      const tableName = getTableName(table)
      return {
        where: (cond: unknown) => {
          const storeRecord = store as unknown as Record<
            string,
            Array<Record<string, unknown>>
          >
          const list = storeRecord[tableName] ?? []
          const condition = cond as SqlCondition
          storeRecord[tableName] = list.filter(
            (row) => !evaluateCondition(row, condition)
          )
          return Promise.resolve([])
        },
      }
    },
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
      return await cb(dbExecutor)
    },
  }
  return dbExecutor
}

describe("Compiler Studio Server Actions (Slice 4.1)", () => {
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

  it("getCompiledOntologyStudioDataAction loads compiled artifacts, linkml_yaml, ohi_yaml, and ohi_lockfile", async () => {
    const data = await getCompiledOntologyStudioDataAction(ONTOLOGY_ID)

    assert.equal(data.ontologyId, ONTOLOGY_ID)
    assert.equal(data.ontologyName, "CompilerStudioTestOntology")
    assert.ok(data.linkmlYaml.includes("Person"))
    assert.ok(data.linkmlYaml.includes("Company"))
    assert.equal(data.ohiYaml, SAMPLE_OHI_YAML)
    assert.deepEqual(data.ohiLockfile, SAMPLE_OHI_LOCKFILE)
    assert.ok(data.artifacts.shacl_ttl.length > 0, "Should compile SHACL")
    assert.ok(data.artifacts.rdfs_ttl.length > 0, "Should compile RDFS")
    assert.ok(data.artifacts.owl_ttl.length > 0, "Should compile OWL")
    assert.ok(
      data.artifacts.pydantic_py.length > 0,
      "Should compile Pydantic"
    )
    assert.ok(
      data.artifacts.json_schema.length > 0,
      "Should compile JSON Schema"
    )
    assert.ok(data.artifacts.er_diagram.length > 0, "Should compile ER diagram")
  })

  it("saveRawLinkmlYamlAction rejects malformed YAML without mutating DB", async () => {
    const originalYaml = store.ontology_documents[0].linkml_yaml
    const malformedYaml = "id: https://example.org/bad\nclasses:\n  Person: [unclosed"

    const result = await saveRawLinkmlYamlAction(ONTOLOGY_ID, malformedYaml)

    assert.equal(result.ok, false)
    if (!result.ok && !result.requiresConfirmation) {
      assert.ok(result.error.length > 0)
      assert.ok(result.diagnostics.length > 0)
    } else {
      assert.fail("Expected syntax/compilation error result")
    }

    assert.equal(
      store.ontology_documents[0].linkml_yaml,
      originalYaml,
      "DB linkml_yaml must remain unchanged on malformed YAML"
    )
  })

  it("saveRawLinkmlYamlAction rejects invalid LinkML schema without mutating DB", async () => {
    const originalYaml = store.ontology_documents[0].linkml_yaml
    const invalidLinkml = `id: https://example.org/invalid
name: InvalidSchema
classes:
  BrokenClass:
    is_a: NonExistentParentClass
`

    const result = await saveRawLinkmlYamlAction(ONTOLOGY_ID, invalidLinkml)

    assert.equal(result.ok, false)
    if (!result.ok && !result.requiresConfirmation) {
      assert.ok(result.error.length > 0)
      assert.ok(
        result.diagnostics.some(
          (d) => d.severity === "FATAL" || d.severity === "ERROR"
        )
      )
    } else {
      assert.fail("Expected LinkML validation error result")
    }

    assert.equal(store.ontology_documents[0].linkml_yaml, originalYaml)
  })

  it("saveRawLinkmlYamlAction returns blast radius requiresConfirmation preview when deleting a class/relation with confirmCascade=false", async () => {
    const originalYaml = store.ontology_documents[0].linkml_yaml
    const prunedSnapshot = createInitialSnapshot()
    prunedSnapshot.classes = prunedSnapshot.classes.filter(
      (c) => c.id !== "Person"
    )
    prunedSnapshot.attributes = prunedSnapshot.attributes.filter(
      (a) => a.class_id !== "Person"
    )
    prunedSnapshot.relations = prunedSnapshot.relations.filter(
      (r) => r.id !== "works_for"
    )
    const yamlWithoutPerson = snapshotToLinkmlYaml(prunedSnapshot)

    const result = await saveRawLinkmlYamlAction(
      ONTOLOGY_ID,
      yamlWithoutPerson,
      false
    )

    assert.equal(result.ok, false)
    if (!result.ok && result.requiresConfirmation) {
      assert.ok(result.cascadePreview.deletedClasses.includes("Person"))
      assert.ok(result.cascadePreview.deletedRelations.includes("works_for"))
      assert.equal(result.cascadePreview.impactedEntitiesCount, 1)
      assert.equal(result.cascadePreview.impactedFactsCount, 1)
      assert.equal(result.cascadePreview.impactedCqsCount, 1)
    } else {
      assert.fail("Expected requiresConfirmation: true result")
    }

    assert.equal(
      store.ontology_documents[0].linkml_yaml,
      originalYaml,
      "DB must not be mutated before confirmation"
    )
    assert.equal(store.document_entities.length, 2)
    assert.equal(store.facts.length, 1)
  })

  it("saveRawLinkmlYamlAction persists valid edits and runs symbol cascades when confirmCascade=true", async () => {
    const prunedSnapshot = createInitialSnapshot()
    prunedSnapshot.classes = prunedSnapshot.classes.filter(
      (c) => c.id !== "Person"
    )
    prunedSnapshot.attributes = prunedSnapshot.attributes.filter(
      (a) => a.class_id !== "Person"
    )
    prunedSnapshot.relations = prunedSnapshot.relations.filter(
      (r) => r.id !== "works_for"
    )
    const yamlWithoutPerson = snapshotToLinkmlYaml(prunedSnapshot)

    const result = await saveRawLinkmlYamlAction(
      ONTOLOGY_ID,
      yamlWithoutPerson,
      true
    )

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.linkmlYaml, yamlWithoutPerson)
      assert.ok(result.data.artifacts.shacl_ttl.length > 0)
    }

    const updatedSnapshot = await loadCanonicalOntology(ONTOLOGY_ID)
    assert.equal(
      updatedSnapshot.classes.find((c) => c.id === "Person"),
      undefined
    )
    assert.equal(
      store.document_entities.filter((e) => e.class_id === "Person").length,
      0,
      "Cascaded deletion should remove Person entities"
    )
    assert.equal(
      store.facts.filter((f) => f.relation_type_id === "works_for").length,
      0,
      "Cascaded deletion should remove works_for facts"
    )
    assert.equal(
      store.ontology_competency_questions[0].subject_class_id,
      null,
      "Cascaded deletion should clear subject_class_id on CQs"
    )
  })

  it("saveRawLinkmlYamlAction persists non-destructive edits without requiring confirmation", async () => {
    const updatedSnapshot = createInitialSnapshot()
    updatedSnapshot.classes.push({
      id: "Department",
      name: "Department",
      description: "An organizational unit",
      module_id: "core",
      instance_policy: "open",
    })
    const updatedYaml = snapshotToLinkmlYaml(updatedSnapshot)

    const result = await saveRawLinkmlYamlAction(ONTOLOGY_ID, updatedYaml)

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.ok(result.data.linkmlYaml.includes("Department"))
      assert.ok(result.data.artifacts.pydantic_py.includes("Department"))
    }
    assert.equal(store.ontology_documents[0].linkml_yaml, updatedYaml)
  })
})
