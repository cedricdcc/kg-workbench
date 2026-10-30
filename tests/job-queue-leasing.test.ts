import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateRetryBackoff,
  shouldMoveToDeadLetter,
  buildClaimJobSql,
  failJob,
  claimJob,
} from "../src/server/events/queue"
import type { DbOrTx } from "../src/server/events/types"

test("calculateRetryBackoff applies exponential delay with floor", () => {
  assert.equal(calculateRetryBackoff(1), 10) // 2^1 * 5s = 10s
  assert.equal(calculateRetryBackoff(2), 20) // 2^2 * 5s = 20s
  assert.equal(calculateRetryBackoff(3), 40) // 2^3 * 5s = 40s
})

test("shouldMoveToDeadLetter triggers when attempts reach maxAttempts", () => {
  assert.equal(shouldMoveToDeadLetter(1, 3), false)
  assert.equal(shouldMoveToDeadLetter(2, 3), false)
  assert.equal(shouldMoveToDeadLetter(3, 3), true)
  assert.equal(shouldMoveToDeadLetter(4, 3), true)
})

test("buildClaimJobSql generates SKIP LOCKED query containing target worker and guards attempts", () => {
  const sql = buildClaimJobSql("extractor", "worker-1", 60)
  assert.ok(sql.includes("FOR UPDATE SKIP LOCKED"))
  assert.ok(sql.includes("extractor"))
  assert.ok(sql.includes("locked_until"))
  assert.ok(sql.includes("status = 'claimed'"))
  // Reviewer Finding 3: guard against infinite crash loops
  assert.ok(sql.includes("attempts < max_attempts"))
})

test("failJob delays next retry with future locked_until timestamp (Reviewer Finding 2)", async () => {
  let updatedValues: Record<string, unknown> | null = null
  const fakeDb = {
    update: () => ({
      set: (val: Record<string, unknown>) => ({
        where: () => {
          updatedValues = val
          return Promise.resolve()
        },
      }),
    }),
  }

  const before = Date.now()
  const result = await failJob(
    fakeDb as unknown as DbOrTx,
    "job-1",
    "network error",
    1, // attempt 1 -> 10s backoff
    3
  )

  assert.equal(result.status, "pending")
  assert.equal(result.nextRetryDelaySeconds, 10)
  assert.ok(updatedValues)
  const values = updatedValues as Record<string, unknown>
  assert.equal(values.error_details, "network error")
  assert.ok(values.locked_until)

  const lockedUntilTime = new Date(values.locked_until as string).getTime()
  assert.ok(
    lockedUntilTime >= before + 9000,
    "locked_until should be at least 9s in future"
  )
  assert.ok(
    lockedUntilTime <= before + 12000,
    "locked_until should be around 10s in future"
  )
})

test("claimJob returns null when no matching pending job exists", async () => {
  const fakeDb = {
    execute: () => Promise.resolve({ rows: [] }),
  }

  const result = await claimJob(
    fakeDb as unknown as DbOrTx,
    "extractor",
    "worker-1"
  )
  assert.equal(result, null)
})

test("claimJob returns claimed job and attaches domain event payload when present", async () => {
  const mockJob = {
    id: "job-100",
    event_id: "evt-200",
    target_worker: "extractor",
    status: "claimed",
    priority: 50,
    attempts: 1,
    max_attempts: 3,
    locked_by: "worker-1",
  }

  const mockPayload = { documentId: "doc-1", provider: "ollama" }

  const fakeDb = {
    execute: () => Promise.resolve({ rows: [mockJob] }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ payload: mockPayload }]),
        }),
      }),
    }),
  }

  const result = await claimJob(
    fakeDb as unknown as DbOrTx,
    "extractor",
    "worker-1"
  )

  assert.ok(result)
  assert.equal(result.job.id, "job-100")
  assert.deepEqual(result.eventPayload, mockPayload)
})
