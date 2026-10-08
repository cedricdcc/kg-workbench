import assert from "node:assert/strict"
import { test } from "node:test"
import { addReferenceOntology } from "../src/features/ontology/server/actions/reference-vocabularies"

test("addReferenceOntology rejects invalid or empty prefix", async () => {
  await assert.rejects(
    () =>
      addReferenceOntology({
        prefix: "",
        name: "Test",
        baseIri: "http://example.org/",
        sourceRegistry: "ols",
        sourceId: "test",
      }),
    /Prefix is required/
  )
})

test("addReferenceOntology rejects missing baseIri", async () => {
  await assert.rejects(
    () =>
      addReferenceOntology({
        prefix: "test",
        name: "Test",
        baseIri: "",
        sourceRegistry: "ols",
        sourceId: "test",
      }),
    /Base IRI is required/
  )
})
