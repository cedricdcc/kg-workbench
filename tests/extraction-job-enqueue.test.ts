import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildExtractionEventPayload,
  enqueueExtractionJob,
} from "../src/features/documents/server/actions/enqueue-extraction-job"
import type { DbOrTx } from "../src/server/events/types"

test("buildExtractionEventPayload constructs well-formed extraction.requested event", () => {
  const payload = buildExtractionEventPayload("doc-123", "onto-456", {
    provider: "ollama",
    model: "llama3",
  })

  assert.equal(payload.eventType, "extraction.requested")
  assert.equal(payload.aggregateType, "document")
  assert.equal(payload.aggregateId, "doc-123")
  assert.equal(payload.payload.ontologyDocumentId, "onto-456")
  assert.equal(payload.payload.provider, "ollama")
  assert.equal(payload.payload.model, "llama3")
})

test("enqueueExtractionJob participates in caller transaction when tx is passed (Reviewer Finding 4)", async () => {
  const operations: string[] = []
  const fakeTx = {
    insert: () => ({
      values: () => ({
        returning: async () => {
          operations.push("insert")
          return [{ id: "mock-id-" + operations.length }]
        },
      }),
    }),
  }

  const result = await enqueueExtractionJob(
    "doc-123",
    "onto-456",
    { provider: "ollama", priority: 80 },
    fakeTx as unknown as DbOrTx
  )

  assert.ok(result.eventId)
  assert.ok(result.jobId)
  assert.equal(operations.length, 2, "Inserted event and job in caller transaction")
})
