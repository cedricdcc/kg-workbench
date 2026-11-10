import assert from "node:assert/strict"
import { test } from "node:test"
import {
  OhiRegistryProvider,
  getRegistryProvider,
  listRegistryProviders,
} from "../src/features/ontology/server/services/vocabulary-registries/ohi-provider"

test("Registry providers catalog includes ohi.dev provider", () => {
  const providers = listRegistryProviders()
  const ids = providers.map((p) => p.id)

  assert.ok(ids.includes("ohi"))
  assert.equal(providers[0].name, "ohi.dev Package Catalog")
  assert.equal(providers[0].requiresApiKey, false)
})

test("getRegistryProvider returns ohi provider for 'ohi' and legacy aliases", () => {
  const ohi = getRegistryProvider("ohi")
  assert.ok(ohi)
  assert.equal(ohi.id, "ohi")
  assert.equal(ohi.requiresApiKey, false)

  // Legacy aliases resolve cleanly for backwards compatibility
  const ols = getRegistryProvider("ols4")
  assert.ok(ols)
  assert.equal(ols.id, "ohi")

  const lov = getRegistryProvider("lov")
  assert.ok(lov)

  const unknown = getRegistryProvider("non_existent_provider")
  assert.equal(unknown, undefined)
})

test("OhiRegistryProvider searches catalog and returns RegistrySearchResult format", async () => {
  const provider = new OhiRegistryProvider()
  const results = await provider.search("prov", { limit: 5 })

  assert.ok(Array.isArray(results))
  assert.ok(results.length > 0)
  const prov = results.find(
    (r) => r.prefix === "prov-o" || r.name.includes("PROV")
  )
  assert.ok(prov)
  assert.equal(prov.source, "ohi")
  assert.ok(prov.baseIri)
  assert.ok(prov.description)
})

test("OhiRegistryProvider fetchTerms extracts classes and slots", async () => {
  const provider = new OhiRegistryProvider()
  const terms = await provider.fetchTerms("w3c/prov-o@2013")

  assert.ok(Array.isArray(terms))
  assert.ok(terms.length >= 5)
  assert.ok(terms.some((t) => t.type === "class" && t.curie === "prov:Entity"))
  assert.ok(
    terms.some(
      (t) => t.type === "property" && t.curie === "prov:wasGeneratedBy"
    )
  )
})

test("OhiRegistryProvider testEndpoint probes catalog and returns valid EndpointTestResult", async () => {
  const provider = new OhiRegistryProvider()
  const probe = await provider.testEndpoint(
    "https://ohi.dev",
    undefined,
    "sosa"
  )

  assert.equal(typeof probe.ok, "boolean")
  assert.equal(probe.statusCode, 200)
  assert.ok(probe.latencyMs >= 0)
  assert.ok(Array.isArray(probe.detectedVocabularies))
})
