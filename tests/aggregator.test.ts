import assert from "node:assert/strict"
import { test } from "node:test"
import {
  searchAllRegistries,
  searchRegistries,
} from "../src/features/ontology/server/services/vocabulary-registries/aggregator"

test("searchAllRegistries queries enabled providers and deduplicates by prefix", async () => {
  const result = await searchAllRegistries("sosa", {
    enabledProviderIds: ["ols4", "bartoc"],
    timeoutMs: 4000,
  })

  assert.ok(Array.isArray(result.results))
  assert.ok(Array.isArray(result.failedProviders))

  // Check prefix deduplication
  const prefixes = result.results.map((r) => r.prefix.toLowerCase())
  const uniquePrefixes = new Set(prefixes)
  assert.equal(prefixes.length, uniquePrefixes.size)
})

test("searchAllRegistries handles failing providers gracefully without aborting healthy ones", async () => {
  const result = await searchAllRegistries("sensor", {
    enabledProviderIds: ["bartoc", "non_existent_provider"],
    timeoutMs: 4000,
  })

  assert.ok(Array.isArray(result.results))
  assert.ok(result.failedProviders.length >= 1)
  assert.ok(result.failedProviders.some((f) => f.providerId === "non_existent_provider"))
})

test("searchRegistries provides backwards-compatible flat array", async () => {
  const results = await searchRegistries("sosa")
  assert.ok(Array.isArray(results))
})
