import assert from "node:assert/strict"
import { test } from "node:test"

test("analystConversations table schema exposes expected columns", async () => {
  const { analystConversations } = await import("../src/server/db/schema")
  assert.ok(analystConversations, "analystConversations table must be defined")
  assert.ok(analystConversations.id, "id column must be defined")
  assert.ok(
    analystConversations.ontology_id,
    "ontology_id column must be defined"
  )
  assert.ok(analystConversations.group_key, "group_key column must be defined")
  assert.ok(analystConversations.title, "title column must be defined")
  assert.ok(
    analystConversations.created_at,
    "created_at column must be defined"
  )
  assert.ok(
    analystConversations.updated_at,
    "updated_at column must be defined"
  )
})

test("analystMessages table schema exposes expected columns", async () => {
  const { analystMessages } = await import("../src/server/db/schema")
  assert.ok(analystMessages, "analystMessages table must be defined")
  assert.ok(analystMessages.id, "id column must be defined")
  assert.ok(
    analystMessages.conversation_id,
    "conversation_id column must be defined"
  )
  assert.ok(analystMessages.sender, "sender column must be defined")
  assert.ok(analystMessages.content, "content column must be defined")
  assert.ok(
    analystMessages.reasoning_trace,
    "reasoning_trace column must be defined"
  )
  assert.ok(analystMessages.subgraph, "subgraph column must be defined")
  assert.ok(analystMessages.citations, "citations column must be defined")
  assert.ok(analystMessages.created_at, "created_at column must be defined")
})

test("knowledgeContradictions table schema exposes expected columns", async () => {
  const { knowledgeContradictions } = await import("../src/server/db/schema")
  assert.ok(
    knowledgeContradictions,
    "knowledgeContradictions table must be defined"
  )
  assert.ok(knowledgeContradictions.id, "id column must be defined")
  assert.ok(
    knowledgeContradictions.ontology_id,
    "ontology_id column must be defined"
  )
  assert.ok(
    knowledgeContradictions.group_key,
    "group_key column must be defined"
  )
  assert.ok(
    knowledgeContradictions.entity_id,
    "entity_id column must be defined"
  )
  assert.ok(
    knowledgeContradictions.entity_label,
    "entity_label column must be defined"
  )
  assert.ok(
    knowledgeContradictions.relation_name,
    "relation_name column must be defined"
  )
  assert.ok(
    knowledgeContradictions.conflict_type,
    "conflict_type column must be defined"
  )
  assert.ok(knowledgeContradictions.fact_a, "fact_a column must be defined")
  assert.ok(knowledgeContradictions.fact_b, "fact_b column must be defined")
  assert.ok(
    knowledgeContradictions.explanation,
    "explanation column must be defined"
  )
  assert.ok(knowledgeContradictions.status, "status column must be defined")
  assert.ok(
    knowledgeContradictions.resolution_action,
    "resolution_action column must be defined"
  )
  assert.ok(
    knowledgeContradictions.created_at,
    "created_at column must be defined"
  )
  assert.ok(
    knowledgeContradictions.updated_at,
    "updated_at column must be defined"
  )
})
