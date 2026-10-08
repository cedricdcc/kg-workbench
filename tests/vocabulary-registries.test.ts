import assert from "node:assert/strict"
import { test } from "node:test"
import { parseOlsTerm, parseLovTerm } from "../src/features/ontology/server/services/vocabulary-registries"

test("parseOlsTerm extracts canonical curie, label, and parent IRIs", () => {
  const raw = {
    obo_id: "SOSA:Observation",
    iri: "http://www.w3.org/ns/sosa/Observation",
    label: "Observation",
    description: ["Act of observing a property."],
    synonyms: ["Measurement"],
    type: "class",
    in_defining_ontology: true,
  }
  const parsed = parseOlsTerm(raw)
  assert.equal(parsed.curie, "sosa:Observation")
  assert.equal(parsed.label, "Observation")
  assert.equal(parsed.description, "Act of observing a property.")
  assert.deepEqual(parsed.synonyms, ["Measurement"])
})

test("parseLovTerm extracts canonical curie, label, and namespace", () => {
  const raw = {
    prefixedName: "dc:title",
    uri: "http://purl.org/dc/elements/1.1/title",
    label: "Title",
    comment: "A name given to the resource.",
    type: "property",
  }
  const parsed = parseLovTerm(raw)
  assert.equal(parsed.curie, "dc:title")
  assert.equal(parsed.label, "Title")
  assert.equal(parsed.description, "A name given to the resource.")
})
