import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatTypeBadge,
  formatFileSize,
} from "../src/features/tabular/components/tabular-profiler-modal/formatters"
import { shouldContinuePolling } from "../src/features/tabular/hooks/polling"

test("formatTypeBadge maps canonical KG types to visual attributes", () => {
  assert.equal(formatTypeBadge("string").variant, "outline")
  assert.equal(formatTypeBadge("number").variant, "secondary")
  assert.equal(formatTypeBadge("boolean").variant, "default")
  assert.equal(formatTypeBadge("date").variant, "secondary")
})

test("formatFileSize converts bytes to readable string", () => {
  assert.equal(formatFileSize(500), "500 B")
  assert.equal(formatFileSize(2048), "2.0 KB")
  assert.equal(formatFileSize(1048576), "1.0 MB")
})

test("shouldContinuePolling returns true for pending or claimed jobs", () => {
  assert.equal(shouldContinuePolling("pending"), true)
  assert.equal(shouldContinuePolling("claimed"), true)
  assert.equal(shouldContinuePolling("completed"), false)
  assert.equal(shouldContinuePolling("failed"), false)
})

