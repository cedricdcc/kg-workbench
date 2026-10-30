import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calculateRetryBackoff,
  shouldMoveToDeadLetter,
  buildClaimJobSql,
} from "../src/server/events/queue"

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

test("buildClaimJobSql generates SKIP LOCKED query containing target worker", () => {
  const sql = buildClaimJobSql("extractor", "worker-1", 60)
  assert.ok(sql.includes("FOR UPDATE SKIP LOCKED"))
  assert.ok(sql.includes("extractor"))
  assert.ok(sql.includes("locked_until"))
  assert.ok(sql.includes("status = 'claimed'"))
})
