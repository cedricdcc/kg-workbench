import assert from "node:assert/strict"
import { test } from "node:test"
import {
  resolveTargetWorker,
  publishDomainEvent,
} from "../src/server/events/outbox"
import type { DbOrTx } from "../src/server/events/types"

test("resolveTargetWorker routes event types to correct workers", () => {
  assert.equal(resolveTargetWorker("extraction.requested"), "extractor")
  assert.equal(resolveTargetWorker("ontology.change_proposed"), "reasoner")
  assert.equal(resolveTargetWorker("ontology.validation_requested"), "reasoner")
  assert.equal(resolveTargetWorker("source.sync_requested"), "tabular")
  assert.equal(resolveTargetWorker("analyst.query_requested"), "analyst")
  assert.equal(resolveTargetWorker("unknown.custom"), "default")
})

test("publishDomainEvent calls transaction inserts and returns event and job IDs", async () => {
  const inserts: { table: string; value: Record<string, unknown> }[] = []
  const fakeTx = {
    insert: (table: unknown) => ({
      values: (val: unknown) => ({
        returning: async () => {
          inserts.push({
            table: (table as Record<symbol, string>)[Symbol.for("drizzle:Name")] || "table",
            value: val as Record<string, unknown>,
          })
          return [{ id: "mock-id-" + inserts.length }]
        },
      }),
    }),
  }

  const result = await publishDomainEvent(
    fakeTx as unknown as DbOrTx,
    {
      eventType: "ontology.change_proposed",
      aggregateType: "ontology",
      aggregateId: "00000000-0000-0000-0000-000000000001",
      payload: { action: "delete_class", classId: "123" },
    },
    { priority: 10 }
  )

  assert.ok(result.eventId)
  assert.ok(result.jobId)
  assert.equal(inserts.length, 2)
  assert.equal(inserts[0].value.event_type, "ontology.change_proposed")
  assert.equal(inserts[1].value.target_worker, "reasoner")
  assert.equal(inserts[1].value.priority, 10)
})
