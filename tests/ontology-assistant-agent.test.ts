import assert from "node:assert/strict"
import { test } from "node:test"
import { POST as applyPost } from "../src/app/api/ontology/assistant/apply/route"
import {
  runOntologyAssistantTurn,
  type AssistantChatMessage,
} from "../src/features/ontology/server/assistant/agent"
import { handleApplyProposalRequest } from "../src/features/ontology/server/assistant/apply"
import {
  computeOntologyFingerprint,
  hashFingerprintPayload,
} from "../src/features/ontology/server/assistant/fingerprint"
import { previewProposedOperations } from "../src/features/ontology/server/assistant-tools/executor"
import { createReadTools } from "../src/features/ontology/server/assistant-tools/read-tools"
import { createWriteTools } from "../src/features/ontology/server/assistant-tools/write-tools"
import type { CanonicalOntologySnapshot } from "../src/features/ontology/server/linkml/types"
import type { LlmClient } from "../src/server/llm/client"
import { runWithGroupKey } from "../src/server/group-access"

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
    modules: [
      { id: "Maritime", name: "Maritime", description: "Core shipping" },
    ],
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

test("runOntologyAssistantTurn runs bounded read-tool loop (up to 4 iterations), never mutates DB, and returns validated ProposedChangePlan", async () => {
  const snapshot = makeSnapshot("onto-1")
  let writeExecuted = false

  const readTools = createReadTools({
    getOntologyDocument: async () => ({
      id: "onto-1",
      name: "Maritime Ontology",
      version: "1.0.0",
      source_file: null,
      created_at: "2026-11-16T00:00:00Z",
      default_language: "en",
      usecase: "Shipping",
      group_key: "test-group",
      linkml_yaml: "id: https://example.org/maritime\nname: maritime\n",
      ohi_yaml: "",
      ohi_lockfile: null,
      ui_layout: { classPositions: {}, moduleLayouts: {} },
      compiled_artifacts: null,
      modules: [],
    }),
    getOntologyModules: async () => [
      {
        id: "Maritime",
        ontology_id: "onto-1",
        name: "Maritime",
        description: "Core shipping",
      },
    ],
    getOntologyClasses: async () => [
      {
        id: "Vessel",
        ontology_id: "onto-1",
        name: "Vessel",
        description: "A watercraft",
        module_id: "Maritime",
        parent_class_id: null,
        instance_policy: "open",
        attributes: [],
      },
    ],
    getOntologyRelations: async () => [],
    getOntologyCQs: async () => [],
    loadCanonicalOntology: async () => snapshot,
    runOntologyLinter: () => ({
      total: 0,
      counts: { error: 0, warning: 0, info: 0 },
      defects: [],
      suppressed: [],
      suppressedCount: 0,
      suppressedByCategory: {},
      defectsByTargetId: {},
      hasErrors: false,
      hasWarnings: false,
      checkedAt: "2026-11-16T00:00:00Z",
    }),
  })

  const writeTools = createWriteTools({
    assertOntologyDocumentAccess: async () => "onto-1",
    saveCanonicalOntology: async () => {
      writeExecuted = true
      throw new Error(
        "saveCanonicalOntology must never be called during preview"
      )
    },
    createCQ: async () => {
      writeExecuted = true
      throw new Error("createCQ must never be called during preview")
    },
  })

  let llmCallCount = 0
  const fakeLlmClient = {
    async generateStructured() {
      llmCallCount += 1
      if (llmCallCount <= 2) {
        return {
          data: {
            action: "call_read_tool",
            tool: llmCallCount === 1 ? "get_ontology_summary" : "list_cqs",
            args: { ontologyId: "onto-1" },
          },
          rawText: "{}",
          trace: {
            provider: "gemini" as const,
            model: "gemini-2.5-flash",
            attempts: [
              { model: "gemini-2.5-flash", status: 200, durationMs: 12 },
            ],
            totalDurationMs: 12,
          },
        }
      }

      return {
        data: {
          action: "final",
          reply:
            "I inspected the ontology and prepared a proposal to add CargoShip.",
          proposedOperations: [
            {
              tool: "create_class",
              args: {
                id: "CargoShip",
                name: "Cargo Ship",
                moduleId: "Maritime",
                description: "Commercial cargo vessel",
              },
            },
          ],
        },
        rawText: "{}",
        trace: {
          provider: "gemini" as const,
          model: "gemini-2.5-flash",
          attempts: [
            { model: "gemini-2.5-flash", status: 200, durationMs: 18 },
          ],
          totalDurationMs: 18,
        },
      }
    },
  } as unknown as LlmClient

  const messages: AssistantChatMessage[] = [
    { role: "user", content: "Add a CargoShip class to Maritime." },
  ]

  const result = await runOntologyAssistantTurn(
    {
      ontologyId: "onto-1",
      groupKey: "test-group",
      messages,
      llmClient: fakeLlmClient,
    },
    {
      assertOntologyDocumentAccess: async () => "onto-1",
      readTools,
      writeTools,
      previewProposedOperations: (ctx, ontologyId, ops) =>
        previewProposedOperations(ctx, ontologyId, ops, { writeTools }),
    }
  )

  assert.equal(writeExecuted, false)
  assert.equal(llmCallCount, 3)
  assert.equal(result.inspectedTools.length, 2)
  assert.equal(result.inspectedTools[0]?.tool, "get_ontology_summary")
  assert.equal(result.inspectedTools[1]?.tool, "list_cqs")
  assert.ok(result.proposal)
  assert.equal(result.proposal.ontologyId, "onto-1")
  assert.equal(result.proposal.operations.length, 1)
  assert.equal(result.proposal.operations[0]?.tool, "create_class")
  assert.equal(result.proposal.operations[0]?.kind, "create")
  assert.deepEqual(result.proposal.validationErrors, [])
  assert.deepEqual(result.executionTrace, {
    provider: "gemini",
    model: "gemini-2.5-flash",
  })
})

test("runOntologyAssistantTurn caps read-tool iterations at 4 even if LLM keeps requesting read tools", async () => {
  const snapshot = makeSnapshot("onto-1")
  const readTools = createReadTools({
    getOntologyDocument: async () => ({
      id: "onto-1",
      name: "Maritime Ontology",
      version: "1.0.0",
      source_file: null,
      created_at: "2026-11-16T00:00:00Z",
      default_language: "en",
      usecase: "Shipping",
      group_key: "test-group",
      linkml_yaml: "id: https://example.org/maritime\nname: maritime\n",
      ohi_yaml: "",
      ohi_lockfile: null,
      ui_layout: { classPositions: {}, moduleLayouts: {} },
      compiled_artifacts: null,
      modules: [],
    }),
    getOntologyModules: async () => [
      {
        id: "Maritime",
        ontology_id: "onto-1",
        name: "Maritime",
        description: "Core shipping",
      },
    ],
    getOntologyClasses: async () => [
      {
        id: "Vessel",
        ontology_id: "onto-1",
        name: "Vessel",
        description: "A watercraft",
        module_id: "Maritime",
        parent_class_id: null,
        instance_policy: "open",
        attributes: [],
      },
    ],
    getOntologyRelations: async () => [],
    getOntologyCQs: async () => [],
    loadCanonicalOntology: async () => snapshot,
    runOntologyLinter: () => ({
      total: 0,
      counts: { error: 0, warning: 0, info: 0 },
      defects: [],
      suppressed: [],
      suppressedCount: 0,
      suppressedByCategory: {},
      defectsByTargetId: {},
      hasErrors: false,
      hasWarnings: false,
      checkedAt: "2026-11-16T00:00:00Z",
    }),
  })

  let llmCallCount = 0
  const fakeLlmClient = {
    async generateStructured() {
      llmCallCount += 1
      return {
        data: {
          action: "call_read_tool",
          tool: "list_cqs",
          args: { ontologyId: "onto-1" },
        },
        rawText: "{}",
        trace: {
          provider: "gemini" as const,
          model: "gemini-2.5-flash",
          attempts: [
            { model: "gemini-2.5-flash", status: 200, durationMs: 10 },
          ],
          totalDurationMs: 10,
        },
      }
    },
  } as unknown as LlmClient

  const result = await runOntologyAssistantTurn(
    {
      ontologyId: "onto-1",
      groupKey: "test-group",
      messages: [{ role: "user", content: "Inspect everything forever" }],
      llmClient: fakeLlmClient,
    },
    {
      assertOntologyDocumentAccess: async () => "onto-1",
      readTools,
    }
  )

  assert.equal(result.inspectedTools.length, 4)
  assert.equal(llmCallCount, 5)
  assert.equal(result.proposal, null)
})

test("POST /api/ontology/assistant/apply returns HTTP 422 with failedStepIndex, failedTool, error, rolledBack: true on failure", async () => {
  const request = new Request(
    "http://localhost:3010/api/ontology/assistant/apply",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ontologyId: "onto-1",
        operations: [
          {
            tool: "nonexistent_write_tool",
            args: {},
          },
        ],
      }),
    }
  )

  const response = await runWithGroupKey("test-group", () => applyPost(request))
  assert.equal(response.status, 422)
  const payload = (await response.json()) as Record<string, unknown>
  assert.deepEqual(payload, {
    ok: false,
    failedStepIndex: 0,
    failedTool: "nonexistent_write_tool",
    error: 'Unknown write tool "nonexistent_write_tool".',
    rolledBack: true,
  })
})

test("handleApplyProposalRequest rolls back mid-transaction failure and returns HTTP 422", async () => {
  const snapshot = makeSnapshot("onto-1")
  const writeTools = createWriteTools({
    assertOntologyDocumentAccess: async () => "onto-1",
    createCQ: async () => ({
      id: "cq-1",
      ontology_id: "onto-1",
      question: "What vessels exist?",
      module_id: null,
      subject_class_id: null,
      predicate_relation_id: null,
      object_class_id: null,
      subject_example_id: null,
      predicate_example_id: null,
      object_example_id: null,
      sort_order: 0,
      created_at: "2026-11-16T00:00:00Z",
    }),
    deleteCQ: async () => {
      throw new Error("Simulated DB constraint failure")
    },
  })

  let rolledBack = false
  const fakeDb = {
    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      try {
        return await fn({ isFakeTx: true })
      } catch (err) {
        rolledBack = true
        throw err
      }
    },
  }

  const request = new Request(
    "http://localhost:3010/api/ontology/assistant/apply",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ontologyId: "onto-1",
        operations: [
          {
            tool: "add_cq",
            args: { question: "What vessels exist?" },
          },
          {
            tool: "delete_cq",
            args: { cqId: "cq-missing" },
          },
        ],
      }),
    }
  )

  const response = await handleApplyProposalRequest(request, {
    getGroupKey: async () => "test-group",
    writeTools,
    getDb: () => fakeDb as never,
    revalidateOntologyPath: () => {},
  })

  assert.equal(rolledBack, true)
  assert.equal(response.status, 422)
  const payload = (await response.json()) as Record<string, unknown>
  assert.deepEqual(payload, {
    ok: false,
    failedStepIndex: 1,
    failedTool: "delete_cq",
    error: "Simulated DB constraint failure",
    rolledBack: true,
  })
  assert.equal(snapshot.classes.length, 1)
})

test("computeOntologyFingerprint returns deterministic SHA-256 hex digest and changes on CQ or YAML changes", async () => {
  const baseInput = {
    linkmlYaml: "id: https://example.org/maritime\nname: maritime\n",
    uiLayout: {
      classPositions: { Vessel: { x: 10, y: 20 } },
      moduleLayouts: {},
    },
    cqs: [
      {
        id: "cq-1",
        question: "What vessels carry cargo?",
        sortOrder: 0,
        subjectClassId: "Vessel",
        predicateRelationId: null,
        objectClassId: null,
        triples: [
          {
            id: "t-1",
            sortOrder: 0,
            subjectClassId: "Vessel",
            predicateRelationId: "carries",
            objectClassId: "Cargo",
          },
        ],
      },
    ],
  }

  const first = await computeOntologyFingerprint("onto-1", "test-group", {
    loadFingerprintInput: async () => baseInput,
  })
  const second = await computeOntologyFingerprint("onto-1", "test-group", {
    loadFingerprintInput: async () => baseInput,
  })

  assert.match(first.fingerprint, /^[a-f0-9]{64}$/)
  assert.equal(first.fingerprint, second.fingerprint)
  assert.equal(first.fingerprint, hashFingerprintPayload(baseInput))

  const modified = await computeOntologyFingerprint("onto-1", "test-group", {
    loadFingerprintInput: async () => ({
      ...baseInput,
      linkmlYaml: `${baseInput.linkmlYaml}# updated\n`,
    }),
  })
  assert.notEqual(first.fingerprint, modified.fingerprint)
})
