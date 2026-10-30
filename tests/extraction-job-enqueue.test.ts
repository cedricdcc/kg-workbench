import assert from "node:assert/strict"
import { test } from "node:test"
import { buildExtractionEventPayload } from "../src/features/documents/server/actions/enqueue-extraction-job"

test("buildExtractionEventPayload constructs well-formed extraction.requested event", () => {
  const payload = buildExtractionEventPayload("doc-123", "onto-456", {
    provider: "ollama",
    model: "llama3",
  })

  assert.equal(payload.eventType, "extraction.requested")
  assert.equal(payload.aggregateType, "document")
  assert.equal(payload.aggregateId, "doc-123")
  assert.equal((payload.payload as any).ontologyDocumentId, "onto-456")
  assert.equal((payload.payload as any).provider, "ollama")
  assert.equal((payload.payload as any).model, "llama3")
})
