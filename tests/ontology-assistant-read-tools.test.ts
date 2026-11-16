import assert from "node:assert/strict"
import { test } from "node:test"
import {
  READ_TOOLS,
  createReadTools,
  type ReadToolsDeps,
} from "../src/features/ontology/server/assistant-tools/read-tools"
import type { OntologyToolContext } from "../src/features/ontology/server/assistant-tools/types"
import { getCurrentGroupKeyOrThrow } from "../src/server/group-access"

const EXPECTED_READ_TOOL_NAMES = [
  "list_ontologies",
  "get_ontology_summary",
  "get_class_details",
  "search_symbols",
  "get_linkml_yaml",
  "list_cqs",
  "get_reasoner_report",
  "check_blast_radius",
  "lint_ontology",
  "run_reasoner",
  "search_ohi_packages",
  "export_ontology",
] as const

const baseCtx: OntologyToolContext = {
  groupKey: "test-group",
}

test("READ_TOOLS registers all 12 read tools with mode='read'", () => {
  const registeredNames = Object.keys(READ_TOOLS).sort()
  const expectedNames = [...EXPECTED_READ_TOOL_NAMES].sort()
  assert.deepEqual(registeredNames, expectedNames)

  for (const name of EXPECTED_READ_TOOL_NAMES) {
    const tool = READ_TOOLS[name]
    assert.ok(tool, `Missing tool ${name}`)
    assert.equal(tool.name, name)
    assert.equal(tool.mode, "read")
    assert.ok(tool.description.length > 0)
    assert.equal(typeof tool.inputSchema.safeParse, "function")
    assert.equal(typeof tool.execute, "function")
  }
})

test("Zod input schemas reject missing ontologyId and invalid formats", () => {
  const missingOntologyId =
    READ_TOOLS.get_ontology_summary.inputSchema.safeParse({})
  assert.equal(missingOntologyId.success, false)

  const emptyOntologyId = READ_TOOLS.list_cqs.inputSchema.safeParse({
    ontologyId: "",
  })
  assert.equal(emptyOntologyId.success, false)

  const badExportFormat = READ_TOOLS.export_ontology.inputSchema.safeParse({
    ontologyId: "onto-1",
    format: "turtle-invalid",
  })
  assert.equal(badExportFormat.success, false)

  const badBlastKind = READ_TOOLS.check_blast_radius.inputSchema.safeParse({
    ontologyId: "onto-1",
    symbolKind: "module",
    symbolId: "mod-1",
  })
  assert.equal(badBlastKind.success, false)

  const validExport = READ_TOOLS.export_ontology.inputSchema.safeParse({
    ontologyId: "onto-1",
    format: "shacl",
  })
  assert.equal(validExport.success, true)
})

test("list_cqs derives covered/uncovered status from linked SPO triples and runs inside groupKey", async () => {
  let observedGroupKey: string | undefined

  const mockDeps: Partial<ReadToolsDeps> = {
    getOntologyCQs: async () => {
      observedGroupKey = await getCurrentGroupKeyOrThrow()
      return [
        {
          id: "cq-1",
          ontology_id: "onto-1",
          group_key: "test-group",
          question: "Which vessels sail to which ports?",
          subject_class_id: "Vessel",
          predicate_relation_id: "sailsTo",
          object_class_id: "Port",
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          sort_order: 0,
          created_at: "2026-11-16T00:00:00.000Z",
          modules: [{ id: "mod-1", name: "Maritime" }],
          triples: [
            {
              id: "triple-1",
              cq_id: "cq-1",
              subject_class_id: "Vessel",
              predicate_relation_id: "sailsTo",
              object_class_id: "Port",
              subject_example_id: null,
              predicate_example_id: null,
              object_example_id: null,
              sort_order: 0,
              created_at: "2026-11-16T00:00:00.000Z",
            },
          ],
        },
        {
          id: "cq-2",
          ontology_id: "onto-1",
          group_key: "test-group",
          question: "What is the cargo weight?",
          subject_class_id: null,
          predicate_relation_id: null,
          object_class_id: null,
          subject_example_id: null,
          predicate_example_id: null,
          object_example_id: null,
          sort_order: 1,
          created_at: "2026-11-16T00:00:00.000Z",
          modules: [],
          triples: [],
        },
      ]
    },
  }

  const tools = createReadTools(mockDeps)
  const result = await tools.list_cqs.execute(baseCtx, { ontologyId: "onto-1" })

  assert.equal(observedGroupKey, "test-group")
  assert.equal(result.total, 2)
  assert.equal(result.coveredCount, 1)
  assert.equal(result.uncoveredCount, 1)
  assert.equal(result.competencyQuestions[0]?.status, "covered")
  assert.equal(result.competencyQuestions[1]?.status, "uncovered")

  const filteredUncovered = await tools.list_cqs.execute(baseCtx, {
    ontologyId: "onto-1",
    status: "uncovered",
  })
  assert.equal(filteredUncovered.total, 1)
  assert.equal(filteredUncovered.competencyQuestions[0]?.id, "cq-2")
})

test("run_reasoner returns pending status cleanly when reasoner job is queued", async () => {
  let observedGroupKey: string | undefined

  const tools = createReadTools({
    requestOntologyReasoningAction: async () => {
      observedGroupKey = await getCurrentGroupKeyOrThrow()
      return {
        status: "pending",
        jobId: "reasoner-job-42",
      }
    },
  })

  const result = await tools.run_reasoner.execute(baseCtx, {
    ontologyId: "onto-1",
  })

  assert.equal(observedGroupKey, "test-group")
  assert.deepEqual(result, {
    status: "pending",
    jobId: "reasoner-job-42",
  })
})
