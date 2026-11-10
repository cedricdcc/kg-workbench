import assert from "node:assert/strict"
import { test } from "node:test"
import { referenceOntologyTerms } from "../src/server/db/schema"

test("referenceOntologyTerms includes property_kind, domain_iris, and range_iris columns", () => {
  assert.ok("property_kind" in referenceOntologyTerms)
  assert.ok("domain_iris" in referenceOntologyTerms)
  assert.ok("range_iris" in referenceOntologyTerms)
})
