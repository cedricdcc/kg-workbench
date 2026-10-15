import assert from "node:assert/strict"
import { test } from "node:test"
import { getOntologyIssuesSummary } from "../src/features/ontology/utils/issues-summary"

test("getOntologyIssuesSummary returns clean when all counts are zero", () => {
  const result = getOntologyIssuesSummary({ error: 0, warning: 0 })
  assert.equal(result.variant, "clean")
  assert.equal(result.label, "Clean")
  assert.equal(result.hasIssues, false)
  assert.equal(result.hasErrors, false)
  assert.equal(result.hasWarnings, false)
  assert.equal(result.hasSuggestions, false)
})

test("getOntologyIssuesSummary prioritizes errors and includes warning count", () => {
  const result = getOntologyIssuesSummary({ error: 1, warning: 2 })
  assert.equal(result.variant, "error")
  assert.equal(result.label, "1 Error · 2 Warnings")
  assert.equal(result.hasIssues, true)
  assert.equal(result.hasErrors, true)
})

test("getOntologyIssuesSummary formats plural errors without warnings", () => {
  const result = getOntologyIssuesSummary({ error: 3, warning: 0 })
  assert.equal(result.variant, "error")
  assert.equal(result.label, "3 Errors")
  assert.equal(result.hasIssues, true)
  assert.equal(result.hasErrors, true)
  assert.equal(result.hasWarnings, false)
})

test("getOntologyIssuesSummary formats singular warning when no errors", () => {
  const result = getOntologyIssuesSummary({ error: 0, warning: 1 })
  assert.equal(result.variant, "warning")
  assert.equal(result.label, "1 Warning")
  assert.equal(result.hasIssues, true)
  assert.equal(result.hasErrors, false)
  assert.equal(result.hasWarnings, true)
})

test("getOntologyIssuesSummary formats plural warnings when no errors", () => {
  const result = getOntologyIssuesSummary({ error: 0, warning: 4 })
  assert.equal(result.variant, "warning")
  assert.equal(result.label, "4 Warnings")
  assert.equal(result.hasIssues, true)
})

test("getOntologyIssuesSummary formats suggestions when zero errors and zero warnings", () => {
  const result = getOntologyIssuesSummary({
    error: 0,
    warning: 0,
    suggestion: 2,
  })
  assert.equal(result.variant, "suggestion")
  assert.equal(result.label, "2 Suggestions")
  assert.equal(result.hasIssues, true)
  assert.equal(result.hasSuggestions, true)
})

test("getOntologyIssuesSummary formats singular suggestion", () => {
  const result = getOntologyIssuesSummary({
    error: 0,
    warning: 0,
    suggestion: 1,
  })
  assert.equal(result.variant, "suggestion")
  assert.equal(result.label, "1 Suggestion")
  assert.equal(result.hasSuggestions, true)
})

test("getOntologyIssuesSummary formats info if only info is present", () => {
  const result = getOntologyIssuesSummary({ error: 0, warning: 0, info: 1 })
  assert.equal(result.variant, "info")
  assert.equal(result.label, "1 Info")
  assert.equal(result.hasIssues, true)
})

test("getOntologyIssuesSummary safely handles undefined optional counts", () => {
  const result = getOntologyIssuesSummary({
    error: 0,
    warning: 0,
    suggestion: undefined,
    info: undefined,
  })
  assert.equal(result.variant, "clean")
  assert.equal(result.label, "Clean")
  assert.equal(result.hasIssues, false)
})
