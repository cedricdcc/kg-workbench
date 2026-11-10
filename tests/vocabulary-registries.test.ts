import assert from "node:assert/strict"
import { test } from "node:test"
import {
  parseOlsTerm,
  parseLovTerm,
  fetchRegistryTerms,
  extractTermsFromLinkmlYaml,
  extractTermsFromTurtle,
} from "../src/features/ontology/server/services/vocabulary-registries"

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
  assert.equal(parsed.type, "property")
})

test("parseLovTerm derives label from curie suffix when label is empty", () => {
  const raw = {
    prefixedName: "sosa:ActuatableProperty",
    uri: "http://www.w3.org/ns/sosa/ActuatableProperty",
    type: "class",
  }
  const parsed = parseLovTerm(raw)
  assert.equal(parsed.curie, "sosa:ActuatableProperty")
  assert.equal(parsed.label, "ActuatableProperty")
  assert.equal(parsed.type, "class")
})

test("fetchRegistryTerms extracts classes and slots from ohi publication", async () => {
  const terms = await fetchRegistryTerms("ohi", "w3c/prov-o@2013")
  assert.ok(Array.isArray(terms))
  assert.ok(terms.length >= 5)

  const entity = terms.find((t) => t.curie === "prov:Entity")
  assert.ok(entity)
  assert.equal(entity.type, "class")
  assert.equal(entity.label, "Entity")

  const wasGeneratedBy = terms.find((t) => t.curie === "prov:wasGeneratedBy")
  assert.ok(wasGeneratedBy)
  assert.equal(wasGeneratedBy.type, "property")
})

test("fetchRegistryTerms resolves short names and extracts SOSA terms", async () => {
  const terms = await fetchRegistryTerms("ohi", "sosa")
  assert.ok(Array.isArray(terms))
  assert.ok(terms.length > 0)

  const observation = terms.find((t) => t.label === "Observation")
  assert.ok(observation)
  assert.equal(observation.type, "class")
  assert.equal(observation.curie, "sosa:Observation")

  const sensor = terms.find((t) => t.label === "Sensor")
  assert.ok(sensor)
  assert.equal(sensor.type, "class")
})

test("fetchRegistryTerms returns empty array gracefully for non-existent package", async () => {
  const terms = await fetchRegistryTerms(
    "ohi",
    "unknown/pkg-does-not-exist@9.9.9"
  )
  assert.deepEqual(terms, [])
})

test("extractTermsFromLinkmlYaml parses classes and slots with prefixes", () => {
  const sampleYaml = `
id: http://example.org/schema
name: sample
prefixes:
  sample: http://example.org/sample#
default_prefix: sample
classes:
  Device:
    description: A sample device.
    is_a: Thing
slots:
  hasId:
    description: Unique identifier.
    range: string
`
  const terms = extractTermsFromLinkmlYaml(sampleYaml)
  assert.equal(terms.length, 2)
  const dev = terms.find((t) => t.curie === "sample:Device")
  assert.ok(dev)
  assert.equal(dev.type, "class")
  assert.equal(dev.description, "A sample device.")
  assert.deepEqual(dev.parentIris, ["Thing"])

  const prop = terms.find((t) => t.curie === "sample:hasId")
  assert.ok(prop)
  assert.equal(prop.type, "property")
})

test("extractTermsFromTurtle parses classes and properties from Turtle string", () => {
  const sampleTtl = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <http://example.org/> .

ex:Device a owl:Class ;
    rdfs:label "Device" ;
    rdfs:comment "A piece of equipment." .

ex:hasStatus a owl:ObjectProperty ;
    rdfs:label "hasStatus" .
`
  const terms = extractTermsFromTurtle(sampleTtl)
  assert.ok(terms.length >= 2)
  const dev = terms.find((t) => t.label === "Device")
  assert.ok(dev)
  assert.equal(dev.type, "class")
  assert.equal(dev.description, "A piece of equipment.")
})
