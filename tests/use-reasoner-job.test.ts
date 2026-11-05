import assert from "node:assert/strict"
import { test } from "node:test"
import { shouldContinuePolling } from "../src/features/ontology/hooks/polling"

test("shouldContinuePolling returns true for pending or claimed jobs", () => {
  assert.equal(shouldContinuePolling("pending"), true)
  assert.equal(shouldContinuePolling("claimed"), true)
  assert.equal(shouldContinuePolling("completed"), false)
  assert.equal(shouldContinuePolling("failed"), false)
  assert.equal(shouldContinuePolling(undefined), false)
  assert.equal(shouldContinuePolling(""), false)
})
