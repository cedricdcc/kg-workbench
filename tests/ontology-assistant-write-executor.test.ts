import assert from "node:assert/strict"
import { test } from "node:test"
import {
  applyProposedOperationsAtomically,
  previewProposedOperations,
} from "../src/features/ontology/server/assistant-tools/executor"
import {
  ALL_ONTOLOGY_TOOLS,
  getOntologyTool,
} from "../src/features/ontology/server/assistant-tools/registry"
import type { OntologyToolContext } from "../src/features/ontology/server/assistant-tools/types"
import {
  WRITE_TOOLS,
  createWriteTools,
  type WriteToolsDeps,
} from "../src/features/ontology/server/assistant-tools/write-tools"
import type { DbClient } from "../src/features/ontology/server/linkml/document-store"
import type { DbTransaction } from "../src/features/ontology/server/linkml/symbol-cascade"
import type { CanonicalOntologySnapshot } from "../src/features/ontology/server/linkml/types"

const EXPECTED_WRITE_TOOL_NAMES = [
  "add_cq",
  "update_cq",
  "delete_cq",
  "link_cq_triple",
  "create_class",
  "update_class",
  "delete_class",
  "rename_symbol",
  "upsert_attribute",
  "delete_attribute",
  "create_relation",
  "update_relation",
  "delete_relation",
  "create_module",
  "apply_linkml_patch",
  "add_ohi_dependency",
] as const

const baseCtx: OntologyToolContext = {
  groupKey: "test-group",
}

function makeSnapshot(ontologyId = "onto-1"): CanonicalOntologySnapshot {
  return {
    document: {
      id: ontologyId,
      name: "Maritime Ontology",
      version: "1.0.0",
      default_language: "en",
      usecase: "Shipping",
      group_key: "test-group",
    },
    modules: [{ id: "Maritime", name: "Maritime", description: "" }],
    classes: [
      {
        id: "Vessel",
        name: "Vessel",
        description: "A watercraft",
        module_id: "Maritime",
        parent_class_id: null,
        instance_policy: "open",
        attributes: [],
      },
    ],
    attributes: [],
    relations: [],
    relation_attributes: [],
    restrictions: [],
    disjointness: [],
    notes: [],
    examples: [],
    localized_texts: [],
    ui_layout: { classPositions: {}, moduleLayouts: {} },
  }
}

test("WRITE_TOOLS and registry register all 16 write tools and 12 read tools", () => {
  const registeredWriteNames = Object.keys(WRITE_TOOLS).sort()
  assert.deepEqual(registeredWriteNames, [...EXPECTED_WRITE_TOOL_NAMES].sort())

  for (const name of EXPECTED_WRITE_TOOL_NAMES) {
    const tool = WRITE_TOOLS[name]
    assert.ok(tool, `Missing write tool ${name}`)
    assert.equal(tool.mode, "write")
    assert.equal(typeof tool.describeOperation, "function")
    assert.equal(getOntologyTool(name), tool)
  }

  assert.equal(Object.keys(ALL_ONTOLOGY_TOOLS).length, 28)
  assert.equal(getOntologyTool("non_existent_tool"), undefined)
})

test("previewProposedOperations validates args, generates summaries, blast-radius warnings, and captures validationErrors without throwing", async () => {
  const tools = createWriteTools({
    getClassBlastRadius: async (_ontologyId, classId) => ({
      targetId: classId,
      targetType: "class",
      targetName: classId,
      riskScore: 45,
      severity: "medium",
      summary: {
        affectedCqsCount: 2,
        affectedFactsCount: 3,
        affectedEntitiesCount: 0,
        affectedRelationsCount: 0,
        affectedSubclassesCount: 0,
        affectedAttributesCount: 0,
      },
      details: {
        competencyQuestions: [
          {
            id: "cq-1",
            question: "Which vessels sail?",
            roles: ["subject"],
          },
          {
            id: "cq-2",
            question: "Where do vessels dock?",
            roles: ["subject"],
          },
        ],
        relations: [],
        subclasses: [],
        attributes: [],
      },
    }),
  })

  const plan = await previewProposedOperations(
    baseCtx,
    "onto-1",
    [
      {
        tool: "create_class",
        args: { name: "Voyage", moduleId: "Maritime", description: "A trip" },
      },
      {
        tool: "rename_symbol",
        args: { symbolKind: "class", oldKey: "Vessel", newKey: "Ship" },
      },
      {
        tool: "create_class",
        args: { name: "" }, // invalid: empty name
      },
      {
        tool: "unknown_tool",
        args: {},
      },
    ],
    { writeTools: tools }
  )

  assert.equal(plan.ontologyId, "onto-1")
  assert.equal(plan.hasDestructiveChanges, true)
  assert.equal(plan.operations.length, 2)
  assert.equal(plan.operations[0]?.tool, "create_class")
  assert.equal(plan.operations[0]?.isDestructive, false)
  assert.match(plan.operations[0]?.summary ?? "", /Voyage/)

  assert.equal(plan.operations[1]?.tool, "rename_symbol")
  assert.equal(plan.operations[1]?.isDestructive, true)
  assert.match(plan.operations[1]?.summary ?? "", /Vessel.*Ship/)
  assert.ok(plan.operations[1]?.blastRadiusWarning)
  assert.match(plan.operations[1]?.blastRadiusWarning ?? "", /3 facts/i)
  assert.match(plan.operations[1]?.blastRadiusWarning ?? "", /2 CQs/i)

  assert.equal(plan.validationErrors.length, 2)
  assert.equal(plan.validationErrors[0]?.index, 2)
  assert.equal(plan.validationErrors[0]?.tool, "create_class")
  assert.equal(plan.validationErrors[1]?.index, 3)
  assert.equal(plan.validationErrors[1]?.tool, "unknown_tool")
})

test("applyProposedOperationsAtomically executes multi-step LinkML + CQ operations inside a single db.transaction", async () => {
  let txCount = 0
  let committed = false
  const observedTxs: unknown[] = []
  const fakeTx = { __txId: "tx-1" } as unknown as DbTransaction

  const fakeDb = {
    transaction: async <T>(cb: (tx: DbTransaction) => Promise<T>) => {
      txCount++
      const res = await cb(fakeTx)
      committed = true
      return res
    },
  } as unknown as DbClient

  const snapshot = makeSnapshot()
  const mockDeps: Partial<WriteToolsDeps> = {
    saveCanonicalOntology: async (_ontologyId, mutator, options) => {
      observedTxs.push(options?.tx)
      const draft = structuredClone(snapshot)
      await mutator(draft)
      return draft
    },
    createCQ: async (ontologyId, data, options) => {
      observedTxs.push(options?.tx)
      return {
        id: "cq-new",
        ontology_id: ontologyId,
        group_key: "test-group",
        question: data.question ?? "",
        subject_class_id: null,
        predicate_relation_id: null,
        object_class_id: null,
        subject_example_id: null,
        predicate_example_id: null,
        object_example_id: null,
        sort_order: 0,
        created_at: new Date().toISOString(),
      }
    },
  }

  const tools = createWriteTools(mockDeps)
  const result = await applyProposedOperationsAtomically(
    { ...baseCtx, db: fakeDb },
    "onto-1",
    [
      { tool: "create_class", args: { name: "Port", moduleId: "Maritime" } },
      { tool: "add_cq", args: { question: "Which ports host vessels?" } },
    ],
    { writeTools: tools }
  )

  assert.equal(txCount, 1)
  assert.equal(committed, true)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.appliedCount, 2)
    assert.equal(result.results.length, 2)
  }
  assert.deepEqual(observedTxs, [fakeTx, fakeTx])
})

test("applyProposedOperationsAtomically rolls back and returns failure metadata when step 2 throws", async () => {
  let rolledBack = false
  const fakeTx = { __txId: "tx-rollback" } as unknown as DbTransaction

  const fakeDb = {
    transaction: async <T>(cb: (tx: DbTransaction) => Promise<T>) => {
      try {
        return await cb(fakeTx)
      } catch (err) {
        rolledBack = true
        throw err
      }
    },
  } as unknown as DbClient

  const snapshot = makeSnapshot()
  const tools = createWriteTools({
    saveCanonicalOntology: async (_ontologyId, mutator) => {
      const draft = structuredClone(snapshot)
      await mutator(draft)
      return draft
    },
    createCQ: async () => {
      throw new Error("Simulated CQ constraint failure")
    },
  })

  const result = await applyProposedOperationsAtomically(
    { ...baseCtx, db: fakeDb },
    "onto-1",
    [
      { tool: "create_class", args: { name: "Cargo" } },
      { tool: "add_cq", args: { question: "Broken CQ" } },
    ],
    { writeTools: tools }
  )

  assert.equal(rolledBack, true)
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.failedStepIndex, 1)
    assert.equal(result.failedTool, "add_cq")
    assert.match(result.error, /Simulated CQ constraint failure/)
    assert.equal(result.rolledBack, true)
  }
})

test("apply_linkml_patch validates linkmlYaml via LinkML runtime/AST before saving", async () => {
  let savedCalled = false
  const tools = createWriteTools({
    saveCanonicalOntology: async (_ontologyId, mutator) => {
      savedCalled = true
      const draft = makeSnapshot()
      const next = await mutator(draft)
      return next ?? draft
    },
  })

  await assert.rejects(
    () =>
      tools.apply_linkml_patch.execute(baseCtx, {
        ontologyId: "onto-1",
        linkmlYaml: "not: [valid: linkml: ::::",
      }),
    /LinkML|YAML|invalid|parse|schema/i
  )
  assert.equal(savedCalled, false)

  const validYaml = [
    "id: https://example.org/maritime",
    "name: maritime",
    "prefixes:",
    "  linkml: https://w3id.org/linkml/",
    "imports:",
    "  - linkml:types",
    "classes:",
    "  Vessel:",
    "    description: A ship or boat",
    "  Port:",
    "    description: A harbor",
  ].join("\n")

  const res = await tools.apply_linkml_patch.execute(baseCtx, {
    ontologyId: "onto-1",
    linkmlYaml: validYaml,
  })
  assert.equal(savedCalled, true)
  assert.ok(res)
})
