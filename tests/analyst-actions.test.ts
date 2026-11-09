import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"
config({ path: ".env.local" })

import { createRequire } from "node:module"
const req = createRequire(import.meta.url)
try {
  const serverOnlyPath = req.resolve("server-only")
  req.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeJS.Module
} catch {
  // Ignore if server-only cannot be resolved
}

import type {
  AnalystConversation,
  AnalystMessage,
  KnowledgeContradiction,
} from "../src/features/analyst/types"

test("Analyst TypeScript contracts define expected properties", () => {
  const conversation: AnalystConversation = {
    id: "conv-1",
    ontologyId: "ont-1",
    groupKey: "shared",
    title: "Marine Ecology Analysis",
    createdAt: "2026-11-09T00:00:00.000Z",
    updatedAt: "2026-11-09T00:00:00.000Z",
  }
  assert.equal(conversation.id, "conv-1")

  const message: AnalystMessage = {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "assistant",
    content: "Found 2 institutions.",
    reasoningTrace: [
      { step: "Graph lookup", detail: "Scanned Baltic institutions" },
    ],
    subgraph: {
      nodes: [{ id: "n1", label: "Baltic Institute", kind: "Organization" }],
      edges: [{ id: "e1", source: "n1", target: "n2", label: "focuses_on" }],
    },
    citations: [
      {
        sourceType: "document",
        sourceId: "doc-1",
        sourceName: "Baltic Marine Report",
        paragraphIndex: 2,
        quoteText: "Research focus includes marine ecology.",
      },
    ],
    createdAt: "2026-11-09T00:01:00.000Z",
  }
  assert.equal(message.sender, "assistant")
  assert.equal(message.citations?.length, 1)

  const contradiction: KnowledgeContradiction = {
    id: "contra-1",
    ontologyId: "ont-1",
    groupKey: "shared",
    entityId: "ent-1",
    entityLabel: "Acme Corp",
    relationName: "headquarters",
    conflictType: "value_mismatch",
    factA: { id: "fact-1", value: "Stockholm" },
    factB: { id: "fact-2", value: "Helsinki" },
    explanation: "Conflicting headquarters locations.",
    status: "open",
    resolutionAction: null,
    createdAt: "2026-11-09T00:00:00.000Z",
    updatedAt: "2026-11-09T00:00:00.000Z",
  }
  assert.equal(contradiction.status, "open")
})

test("createConversationAction validates ontologyId and creates conversation", async () => {
  const { createConversationAction } =
    await import("../src/features/analyst/server/actions/create-conversation")

  await assert.rejects(
    () => createConversationAction({ ontologyId: "" }),
    /ontologyId is required/
  )

  const insertedRows: Array<Record<string, unknown>> = []
  const mockDb = {
    insert: () => ({
      values: (val: Record<string, unknown>) => {
        insertedRows.push(val)
        return {
          returning: () =>
            Promise.resolve([
              {
                id: "mock-conv-123",
                ontology_id: val.ontology_id,
                group_key: val.group_key || "shared",
                title: val.title,
                created_at: "2026-11-09T12:00:00.000Z",
                updated_at: "2026-11-09T12:00:00.000Z",
              },
            ]),
        }
      },
    }),
  }

  const result = await createConversationAction(
    { ontologyId: "00000000-0000-0000-0000-000000000001", title: "Test Chat" },
    mockDb as unknown as Parameters<typeof createConversationAction>[1]
  )

  assert.equal(result.id, "mock-conv-123")
  assert.equal(result.ontologyId, "00000000-0000-0000-0000-000000000001")
  assert.equal(result.title, "Test Chat")
  assert.equal(result.groupKey, "shared")
  assert.equal(insertedRows.length, 1)
})

test("createConversationAction uses default title when not provided", async () => {
  const { createConversationAction } =
    await import("../src/features/analyst/server/actions/create-conversation")

  const mockDb = {
    insert: () => ({
      values: (val: Record<string, unknown>) => ({
        returning: () =>
          Promise.resolve([
            {
              id: "mock-conv-def",
              ontology_id: val.ontology_id,
              group_key: val.group_key || "shared",
              title: val.title,
              created_at: "2026-11-09T12:00:00.000Z",
              updated_at: "2026-11-09T12:00:00.000Z",
            },
          ]),
      }),
    }),
  }

  const result = await createConversationAction(
    { ontologyId: "00000000-0000-0000-0000-000000000001" },
    mockDb as unknown as Parameters<typeof createConversationAction>[1]
  )

  assert.equal(result.title, "New Analysis")
})

test("getConversationsQuery returns empty array on empty ontologyId and selects matching conversations", async () => {
  const { getConversationsQuery } =
    await import("../src/features/analyst/server/queries/get-conversations")

  const emptyRes = await getConversationsQuery("")
  assert.deepEqual(emptyRes, [])

  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve([
              {
                id: "conv-row-1",
                ontology_id: "ont-1",
                group_key: "shared",
                title: "First Analysis",
                created_at: "2026-11-09T10:00:00.000Z",
                updated_at: "2026-11-09T11:00:00.000Z",
              },
            ]),
        }),
      }),
    }),
  }

  const list = await getConversationsQuery(
    "ont-1",
    mockDb as unknown as Parameters<typeof getConversationsQuery>[1]
  )
  assert.equal(list.length, 1)
  assert.equal(list[0].id, "conv-row-1")
  assert.equal(list[0].ontologyId, "ont-1")
  assert.equal(list[0].title, "First Analysis")
})

test("getMessagesQuery returns empty on blank conversationId and selects ordered messages", async () => {
  const { getMessagesQuery } =
    await import("../src/features/analyst/server/queries/get-messages")

  const emptyRes = await getMessagesQuery("")
  assert.deepEqual(emptyRes, [])

  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve([
              {
                id: "msg-1",
                conversation_id: "conv-1",
                sender: "user",
                content: "Hello",
                reasoning_trace: null,
                subgraph: null,
                citations: null,
                created_at: "2026-11-09T10:00:00.000Z",
              },
              {
                id: "msg-2",
                conversation_id: "conv-1",
                sender: "assistant",
                content: "Hi there",
                reasoning_trace: [{ step: "Greeting", detail: "Responded" }],
                subgraph: { nodes: [], edges: [] },
                citations: [],
                created_at: "2026-11-09T10:01:00.000Z",
              },
            ]),
        }),
      }),
    }),
  }

  const messages = await getMessagesQuery(
    "conv-1",
    mockDb as unknown as Parameters<typeof getMessagesQuery>[1]
  )
  assert.equal(messages.length, 2)
  assert.equal(messages[0].sender, "user")
  assert.equal(messages[1].sender, "assistant")
  assert.equal(messages[1].reasoningTrace?.[0].step, "Greeting")
})

test("sendQueryAction validates input, persists user message, and publishes domain event", async () => {
  const { sendQueryAction } =
    await import("../src/features/analyst/server/actions/send-query")

  await assert.rejects(
    () =>
      sendQueryAction({
        conversationId: "",
        ontologyId: "ont-1",
        query: "test",
      }),
    /conversationId is required/
  )
  await assert.rejects(
    () =>
      sendQueryAction({
        conversationId: "conv-1",
        ontologyId: "",
        query: "test",
      }),
    /ontologyId is required/
  )
  await assert.rejects(
    () =>
      sendQueryAction({
        conversationId: "conv-1",
        ontologyId: "ont-1",
        query: "",
      }),
    /query is required/
  )

  const insertedRows: Array<{ table: string; value: Record<string, unknown> }> =
    []
  const mockTx = {
    insert: () => ({
      values: (val: Record<string, unknown>) => {
        insertedRows.push({
          table: "tableName",
          value: val,
        })
        return {
          returning: () =>
            Promise.resolve([
              {
                id: "mock-gen-id-" + insertedRows.length,
                conversation_id: val.conversation_id,
                sender: val.sender,
                content: val.content,
                created_at: "2026-11-09T12:00:00.000Z",
              },
            ]),
        }
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve([]),
        }),
        where: () => Promise.resolve([]),
      }),
    }),
  }

  const result = await sendQueryAction(
    {
      conversationId: "conv-123",
      ontologyId: "00000000-0000-0000-0000-000000000001",
      query: "Which institutions focus on marine biology?",
    },
    mockTx as unknown as Parameters<typeof sendQueryAction>[1]
  )

  assert.ok(result.userMessage)
  assert.equal(
    result.userMessage.content,
    "Which institutions focus on marine biology?"
  )
  assert.equal(result.userMessage.sender, "user")
  assert.ok(result.jobId)
  assert.ok(result.eventId)

  assert.equal(insertedRows.length, 3)
  assert.equal(
    insertedRows[0].value.content,
    "Which institutions focus on marine biology?"
  )
  assert.equal(insertedRows[0].value.sender, "user")
  assert.equal(insertedRows[1].value.event_type, "analyst.query_requested")
  assert.equal(insertedRows[2].value.target_worker, "analyst")
})

test("resolveContradictionAction validates input and updates contradiction status and notes", async () => {
  const { resolveContradictionAction } =
    await import("../src/features/analyst/server/actions/resolve-contradiction")

  await assert.rejects(
    () =>
      resolveContradictionAction({ contradictionId: "", status: "resolved" }),
    /contradictionId is required/
  )
  await assert.rejects(
    () =>
      resolveContradictionAction({
        contradictionId: "contra-1",
        status: "invalid_status" as unknown as "resolved",
      }),
    /invalid status/i
  )

  const updatedRecords: Array<Record<string, unknown>> = []
  const mockDb = {
    update: () => ({
      set: (val: Record<string, unknown>) => {
        updatedRecords.push(val)
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: "contra-1",
                  ontology_id: "ont-1",
                  group_key: "shared",
                  entity_id: "ent-1",
                  entity_label: "Acme Corp",
                  relation_name: "headquarters",
                  conflict_type: "value_mismatch",
                  fact_a: { id: "fact-1", value: "Stockholm" },
                  fact_b: { id: "fact-2", value: "Helsinki" },
                  explanation: "Conflicting headquarters locations.",
                  status: val.status,
                  resolution_action: val.resolution_action,
                  created_at: "2026-11-09T00:00:00.000Z",
                  updated_at: "2026-11-09T13:00:00.000Z",
                },
              ]),
          }),
        }
      },
    }),
  }

  const result = await resolveContradictionAction(
    {
      contradictionId: "contra-1",
      status: "resolved",
      actionNotes: "Accepted Fact A (Stockholm)",
    },
    mockDb as unknown as Parameters<typeof resolveContradictionAction>[1]
  )

  assert.equal(result.id, "contra-1")
  assert.equal(result.status, "resolved")
  assert.equal(result.resolutionAction, "Accepted Fact A (Stockholm)")
  assert.equal(updatedRecords.length, 1)
  assert.equal(updatedRecords[0].status, "resolved")
  assert.equal(
    updatedRecords[0].resolution_action,
    "Accepted Fact A (Stockholm)"
  )
})

test("getContradictionsQuery returns empty on empty ontologyId and selects matching contradictions", async () => {
  const { getContradictionsQuery } =
    await import("../src/features/analyst/server/queries/get-contradictions")

  const emptyRes = await getContradictionsQuery("")
  assert.deepEqual(emptyRes, [])

  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve([
              {
                id: "contra-1",
                ontology_id: "ont-1",
                group_key: "shared",
                entity_id: "ent-1",
                entity_label: "Acme Corp",
                relation_name: "headquarters",
                conflict_type: "value_mismatch",
                fact_a: { id: "fact-1", value: "Stockholm" },
                fact_b: { id: "fact-2", value: "Helsinki" },
                explanation: "Conflicting headquarters locations.",
                status: "open",
                resolution_action: null,
                created_at: "2026-11-09T00:00:00.000Z",
                updated_at: "2026-11-09T00:00:00.000Z",
              },
            ]),
        }),
      }),
    }),
  }

  const res = await getContradictionsQuery(
    "ont-1",
    mockDb as unknown as Parameters<typeof getContradictionsQuery>[1]
  )
  assert.equal(res.length, 1)
  assert.equal(res[0].id, "contra-1")
  assert.equal(res[0].entityLabel, "Acme Corp")
  assert.equal(res[0].conflictType, "value_mismatch")
})
