import test from "node:test"
import assert from "node:assert/strict"
import { resolveExternalUri } from "../src/features/ontology/utils/external-uri"

test("resolveExternalUri resolves known CURIEs to full external IRIs", () => {
  assert.equal(
    resolveExternalUri("sosa:Sample"),
    "http://www.w3.org/ns/sosa/Sample"
  )
  assert.equal(resolveExternalUri("schema:Person"), "https://schema.org/Person")
  assert.equal(
    resolveExternalUri("skos:Concept"),
    "http://www.w3.org/2004/02/skos/core#Concept"
  )
  assert.equal(
    resolveExternalUri("envo:00000001"),
    "http://purl.obolibrary.org/obo/ENVO_00000001"
  )
})

test("resolveExternalUri returns full IRI when already prefixed with http/https", () => {
  assert.equal(
    resolveExternalUri("http://www.w3.org/ns/sosa/Sample"),
    "http://www.w3.org/ns/sosa/Sample"
  )
  assert.equal(
    resolveExternalUri("https://schema.org/Place"),
    "https://schema.org/Place"
  )
})

test("resolveExternalUri prioritizes explicit IRI when passed", () => {
  assert.equal(
    resolveExternalUri("custom:Term", "http://example.org/custom/Term"),
    "http://example.org/custom/Term"
  )
})

test("resolveExternalUri returns null for unrecognized local identifiers", () => {
  assert.equal(resolveExternalUri("Sample"), null)
  assert.equal(resolveExternalUri(""), null)
  assert.equal(resolveExternalUri(null), null)
  assert.equal(resolveExternalUri(undefined), null)
})
