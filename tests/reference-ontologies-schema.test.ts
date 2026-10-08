import assert from "node:assert/strict"
import { test } from "node:test"
import {
  referenceOntologies,
  referenceOntologyTerms,
} from "../src/server/db/schema"

test("referenceOntologies schema exposes expected columns", () => {
  assert.ok(referenceOntologies.prefix)
  assert.ok(referenceOntologies.base_iri)
  assert.ok(referenceOntologies.source_registry)
  assert.ok(referenceOntologies.group_key)
  assert.equal(referenceOntologies.synced_at.name, "synced_at")
  assert.equal(referenceOntologies.created_at.name, "created_at")
})

test("referenceOntologyTerms schema exposes expected columns", () => {
  assert.ok(referenceOntologyTerms.curie)
  assert.ok(referenceOntologyTerms.iri)
  assert.ok(referenceOntologyTerms.label)
  assert.ok(referenceOntologyTerms.embedding)
  assert.ok(referenceOntologyTerms.parent_iris)
})
