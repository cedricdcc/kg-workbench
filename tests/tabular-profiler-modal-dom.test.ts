import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatTypeBadge,
  formatFileSize,
  resolveEffectiveProfilerResult,
  resolveEffectiveFileFormat,
  resolveEffectiveDatasetId,
} from "../src/features/tabular/components/tabular-profiler-modal/formatters"
import { shouldContinuePolling } from "../src/features/tabular/hooks/polling"
import type { TabularProfileResult } from "../src/features/tabular/types"

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

test("resolveEffectiveProfilerResult prioritizes fresh internal profiling results over stale external result prop", () => {
  const externalResult: TabularProfileResult = {
    fileName: "stale_last_added.csv",
    fileType: "csv",
    rowCount: 100,
    columnCount: 5,
    estimatedSizeBytes: 1024,
    columns: [],
    candidateKeys: [],
    previewRows: [],
  }

  const internalResult: TabularProfileResult = {
    fileName: "fresh_inspected.csv",
    fileType: "csv",
    rowCount: 20,
    columnCount: 3,
    estimatedSizeBytes: 512,
    columns: [],
    candidateKeys: [],
    previewRows: [],
  }

  // When both exist and not dismissed, internal fresh profile must take precedence over external prop
  assert.equal(
    resolveEffectiveProfilerResult(externalResult, internalResult, false)
      ?.fileName,
    "fresh_inspected.csv"
  )

  // When only external exists, it is used
  assert.equal(
    resolveEffectiveProfilerResult(externalResult, null, false)?.fileName,
    "stale_last_added.csv"
  )

  // When dismissed, external result is ignored even if internal is null
  assert.equal(resolveEffectiveProfilerResult(externalResult, null, true), null)

  // When dismissed and internal exists, internal is used
  assert.equal(
    resolveEffectiveProfilerResult(externalResult, internalResult, true)
      ?.fileName,
    "fresh_inspected.csv"
  )
})

test("resolveEffectiveFileFormat and resolveEffectiveDatasetId prevent state leaking when switching to internal source", () => {
  const externalResult: TabularProfileResult = {
    fileName: "orders.csv",
    fileType: "csv",
    rowCount: 50,
    columnCount: 4,
    estimatedSizeBytes: 2048,
    columns: [],
    candidateKeys: [],
    previewRows: [],
  }

  // Case 1: External inspected source is active (isUsingInternal = false)
  assert.equal(resolveEffectiveFileFormat(externalResult, "csv", false), "csv")
  assert.equal(
    resolveEffectiveDatasetId("uuid-archive-1", false),
    "uuid-archive-1"
  )

  // Case 2: User switched to remote database inside modal (isUsingInternal = true)
  assert.equal(
    resolveEffectiveFileFormat(externalResult, "postgres", true),
    "postgres"
  )
  assert.equal(
    resolveEffectiveDatasetId("uuid-archive-1", true),
    undefined,
    "DatasetId of previously inspected dataset must be cleared when mapping an internal source"
  )
})
