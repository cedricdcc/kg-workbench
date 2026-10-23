import assert from "node:assert/strict"
import { test } from "node:test"
import {
  addReferenceOntology,
  findNearestStandardTerms,
} from "../src/features/ontology/server/actions/reference-vocabularies"

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

test("findNearestStandardTerms returns empty array for empty query string", async () => {
  const result = await findNearestStandardTerms("")
  assert.deepEqual(result, [])
})

test("getReferenceOntologyTerms returns an empty array for empty ontologyId", async () => {
  const { getReferenceOntologyTerms } =
    await import("../src/features/ontology/server/queries/reference-vocabularies")
  const terms = await getReferenceOntologyTerms("")
  assert.ok(Array.isArray(terms))
  assert.equal(terms.length, 0)
})

test("testRegistryEndpoint probes a registry and returns valid result structure", async () => {
  const { testRegistryEndpoint } =
    await import("../src/features/ontology/server/actions/reference-vocabularies")
  const result = await testRegistryEndpoint({
    providerId: "bartoc",
    endpointUrl: "https://bartoc.org/api/voc",
    testQuery: "sensor",
  })
  assert.equal(typeof result.ok, "boolean")
  assert.equal(typeof result.latencyMs, "number")
  assert.equal(typeof result.statusCode, "number")
})

test("saveEndpointSnapshot, getEndpointSnapshots and deleteEndpointSnapshot cycle", async () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:cbca93016c7c6612ba0c1bb0d1465c66@127.0.0.1:5433/postgres"
  const { saveEndpointSnapshot, getEndpointSnapshots, deleteEndpointSnapshot } =
    await import("../src/features/ontology/server/actions/reference-vocabularies")

  const saved = await saveEndpointSnapshot({
    providerId: "bartoc",
    endpointUrl: "https://bartoc.org/api/voc",
    statusCode: 200,
    latencyMs: 120,
    queryParams: "?search=sensor",
    responsePayload: JSON.stringify([
      { uri: "http://example.org", prefLabel: { en: "Test" } },
    ]),
    detectedVocabCount: 1,
  })

  assert.ok(saved.id)

  const snapshots = await getEndpointSnapshots("bartoc")
  assert.ok(Array.isArray(snapshots))
  const found = snapshots.find((s) => s.id === saved.id)
  assert.ok(found)
  assert.equal(found?.providerId, "bartoc")

  await deleteEndpointSnapshot(saved.id)

  const afterDelete = await getEndpointSnapshots("bartoc")
  assert.ok(!afterDelete.some((s) => s.id === saved.id))
})
