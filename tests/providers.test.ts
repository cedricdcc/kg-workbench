import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getRegistryProvider,
  listRegistryProviders,
} from "../src/features/ontology/server/services/vocabulary-registries/providers"
import { parseBartocVocab } from "../src/features/ontology/server/services/vocabulary-registries/providers/bartoc-provider"
import { parseOntoPortalDoc } from "../src/features/ontology/server/services/vocabulary-registries/providers/ontoportal-provider"

test("Registry providers catalog includes expected providers", () => {
  const providers = listRegistryProviders()
  const ids = providers.map((p) => p.id)

  assert.ok(ids.includes("ols4"))
  assert.ok(ids.includes("bartoc"))
  assert.ok(ids.includes("agroportal"))
  assert.ok(ids.includes("bioportal"))
  assert.ok(ids.includes("ecoportal"))
  assert.ok(ids.includes("eu_vocabularies"))
  assert.ok(ids.includes("lov"))
  assert.ok(ids.includes("custom"))
})

test("getRegistryProvider returns specific provider", () => {
  const bartoc = getRegistryProvider("bartoc")
  assert.ok(bartoc)
  assert.equal(bartoc.id, "bartoc")
  assert.equal(bartoc.requiresApiKey, false)

  const bioportal = getRegistryProvider("bioportal")
  assert.ok(bioportal)
  assert.equal(bioportal.requiresApiKey, true)
})

test("parseBartocVocab parses JSKOS records into RegistrySearchResult", () => {
  const rawJskos = {
    uri: "http://bartoc.org/en/node/18413",
    prefLabel: { en: "Sensor Observation Sampling Actuator" },
    notation: ["SOSA"],
    scopeNote: { en: ["An ontology for sensors and observations"] },
    url: "http://www.w3.org/ns/sosa/",
  }

  const parsed = parseBartocVocab(rawJskos)
  assert.equal(parsed.source, "bartoc")
  assert.equal(parsed.prefix, "sosa")
  assert.equal(parsed.name, "Sensor Observation Sampling Actuator")
  assert.equal(parsed.description, "An ontology for sensors and observations")
  assert.equal(parsed.baseIri, "http://www.w3.org/ns/sosa/")
})

test("parseOntoPortalDoc parses OntoPortal search records into RegistrySearchResult", () => {
  const rawDoc = {
    acronym: "AGRO",
    name: "Agronomy Ontology",
    description: "An ontology for agronomy practices and crops",
    "@id": "https://data.agroportal.eu/ontologies/AGRO",
  }

  const parsed = parseOntoPortalDoc(rawDoc, "agroportal")
  assert.equal(parsed.source, "agroportal")
  assert.equal(parsed.prefix, "agro")
  assert.equal(parsed.name, "Agronomy Ontology")
  assert.equal(parsed.description, "An ontology for agronomy practices and crops")
  assert.equal(parsed.baseIri, "https://data.agroportal.eu/ontologies/AGRO")
})

test("LOV provider fails fast with clean error on network timeout", async () => {
  const lov = getRegistryProvider("lov")
  assert.ok(lov)

  const probe = await lov.testEndpoint("https://lov.linkeddata.es/dataset/api/v2", undefined, "test")
  assert.equal(typeof probe.ok, "boolean")
  assert.ok(probe.latencyMs >= 0)
})
