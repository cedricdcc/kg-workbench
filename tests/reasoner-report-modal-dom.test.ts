import assert from "node:assert/strict"
import { test } from "node:test"
import { formatViolationBadge } from "../src/features/ontology/components/reasoner-modal/formatters"

test("formatViolationBadge maps severity to visual attributes", () => {
  const violationBadge = formatViolationBadge("Violation")
  assert.equal(violationBadge.variant, "destructive")

  const warningBadge = formatViolationBadge("Warning")
  assert.equal(warningBadge.variant, "secondary")

  const infoBadge = formatViolationBadge("Info")
  assert.equal(infoBadge.variant, "outline")
})
