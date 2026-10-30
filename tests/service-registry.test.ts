import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateServiceHealth,
  parseHeartbeatPayload,
  recordServiceHeartbeat,
} from "../src/server/events/services"
import type { DbOrTx } from "../src/server/events/types"

test("calculateServiceHealth flags fresh heartbeat as online", () => {
  const now = new Date()
  assert.equal(calculateServiceHealth(now, 30), "online")
})

test("calculateServiceHealth flags stale heartbeat as degraded or offline", () => {
  const degradedTime = new Date(Date.now() - 45 * 1000) // 45s ago
  assert.equal(calculateServiceHealth(degradedTime, 30), "degraded")

  const offlineTime = new Date(Date.now() - 120 * 1000) // 2m ago
  assert.equal(calculateServiceHealth(offlineTime, 30), "offline")
})

test("parseHeartbeatPayload validates valid worker payload", () => {
  const valid = {
    id: "reasoner-worker",
    displayName: "Oxigraph SHACL Reasoner",
    capabilities: ["blast_radius", "shacl_validation"],
    metadata: { version: "0.1.0" },
  }
  const result = parseHeartbeatPayload(valid)
  assert.ok(result)
  assert.equal(result.id, "reasoner-worker")
  assert.equal(result.displayName, "Oxigraph SHACL Reasoner")
  assert.equal(result.capabilities.length, 2)
})

test("parseHeartbeatPayload rejects malformed payload", () => {
  assert.equal(parseHeartbeatPayload(null), null)
  assert.equal(parseHeartbeatPayload({}), null)
  assert.equal(parseHeartbeatPayload({ id: "test" }), null)
})

test("recordServiceHeartbeat executes atomic onConflictDoUpdate upsert (Reviewer Finding 5)", async () => {
  let conflictTarget: unknown = null
  let insertedValues: Record<string, unknown> | null = null
  let updateSet: Record<string, unknown> | null = null

  const fakeDb = {
    insert: () => ({
      values: (val: Record<string, unknown>) => {
        insertedValues = val
        return {
          onConflictDoUpdate: (config: {
            target: unknown
            set: Record<string, unknown>
          }) => {
            conflictTarget = config.target
            updateSet = config.set
            return Promise.resolve()
          },
        }
      },
    }),
  }

  await recordServiceHeartbeat(fakeDb as unknown as DbOrTx, {
    id: "reasoner-worker",
    displayName: "Oxigraph Reasoner",
    capabilities: ["blast_radius"],
  })

  assert.ok(insertedValues)
  const inserted = insertedValues as Record<string, unknown>
  assert.equal(inserted.id, "reasoner-worker")
  assert.ok(conflictTarget, "Should target primary key column")
  assert.ok(updateSet, "Should configure ON CONFLICT DO UPDATE set fields")
  const setObj = updateSet as Record<string, unknown>
  assert.equal(setObj.status, "online")
})
