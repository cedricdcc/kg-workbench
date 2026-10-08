import assert from "node:assert/strict"
import { test } from "node:test"
import {
  cosineSimilarity,
  rankTermsBySimilarity,
} from "../src/features/ontology/server/services/vector-similarity"
import { getLocalEmbedding } from "../src/server/embedding/local-embedder"

test("cosineSimilarity returns 1.0 for identical normalized vectors", () => {
  const v1 = [1, 0, 0]
  const v2 = [1, 0, 0]
  assert.equal(Math.round(cosineSimilarity(v1, v2) * 100) / 100, 1.0)
})

test("cosineSimilarity returns 0.0 for orthogonal vectors", () => {
  const v1 = [1, 0]
  const v2 = [0, 1]
  assert.equal(cosineSimilarity(v1, v2), 0)
})

test("cosineSimilarity gracefully handles empty or zero magnitude vectors", () => {
  assert.equal(cosineSimilarity([], []), 0)
  assert.equal(cosineSimilarity([0, 0], [1, 2]), 0)
})

test("rankTermsBySimilarity sorts candidate terms descending by score", () => {
  const query = [1, 1]
  const candidates = [
    { curie: "envo:001", embedding: [0, 1] },
    { curie: "sosa:Observation", embedding: [1, 1] },
  ]
  const ranked = rankTermsBySimilarity(query, candidates)
  assert.equal(ranked[0].curie, "sosa:Observation")
  assert.equal(ranked[1].curie, "envo:001")
})

test("getLocalEmbedding produces normalized 384-dimensional vector without external API credits", async () => {
  const vec = await getLocalEmbedding("Sampling event for sea temperature")
  assert.equal(vec.length, 384)
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  assert.ok(Math.abs(norm - 1.0) < 0.01)
})
