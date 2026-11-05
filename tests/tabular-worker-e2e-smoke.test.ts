import { config } from "dotenv"
config({ path: ".env.local" })

import assert from "node:assert/strict"
import { test } from "node:test"
import { getDb } from "../src/server/db"
import { publishDomainEvent } from "../src/server/events/outbox"
import { fastPathAwaitJob } from "../src/server/events/queue"
import type { TabularProfileResult } from "../src/features/tabular/types"

test("live tabular worker claims and profiles dataset from job_queue", async () => {
  const db = getDb()

  const csvData = [
    "product_id,product_name,in_stock,unit_price,created_date",
    "P-001,Wireless Mouse,true,29.99,2026-01-15",
    "P-002,Mechanical Keyboard,false,89.50,2026-02-10",
    "P-003,USB-C Hub,true,45.00,2026-03-01",
  ].join("\n")

  const csvBase64 = Buffer.from(csvData).toString("base64")
  const testAggregateId = "b0000000-0000-4000-8000-000000000001"

  // 1. Enqueue job
  const { jobId } = await publishDomainEvent(
    db,
    {
      eventType: "tabular.profile_requested",
      aggregateType: "dataset",
      aggregateId: testAggregateId,
      payload: {
        fileName: "catalog.csv",
        fileType: "csv",
        fileBufferBase64: csvBase64,
        options: {},
      },
    },
    { priority: 100, targetWorker: "tabular" }
  )

  assert.ok(jobId, "jobId should be created")

  // 2. Await worker pickup and completion
  const outcome = await fastPathAwaitJob<TabularProfileResult>(
    db,
    jobId,
    8000,
    150
  )

  assert.equal(outcome.resolved, true, "Job should resolve within timeout")
  assert.equal(outcome.status, "completed", "Job status should be completed")
  assert.ok(outcome.result, "Job should contain result payload")
  assert.equal(outcome.result.rowCount, 3)
  assert.equal(outcome.result.columnCount, 5)

  const colMap = new Map(outcome.result.columns.map((c) => [c.name, c]))
  assert.equal(colMap.get("product_id")?.isUniqueCandidate, true)
  assert.equal(colMap.get("product_id")?.inferredKgType, "string")
  assert.equal(colMap.get("in_stock")?.inferredKgType, "boolean")
  assert.equal(colMap.get("unit_price")?.inferredKgType, "number")
  assert.equal(colMap.get("created_date")?.inferredKgType, "date")

  assert.ok(outcome.result.processedBy, "Should include worker identifier")
  assert.ok(
    outcome.result.processedBy.toLowerCase().includes("tabular"),
    `Worker id '${outcome.result.processedBy}' should mention tabular`
  )
})

