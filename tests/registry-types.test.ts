import assert from "node:assert/strict"
import { test } from "node:test"
import type {
  VocabularyRegistryProvider,
  EndpointTestResult,
} from "../src/features/ontology/server/services/vocabulary-registries/types"

test("Vocabulary Registry Types support provider definition", async () => {
  const mockProvider: VocabularyRegistryProvider = {
    id: "mock",
    name: "Mock Registry",
    defaultEndpoint: "https://example.com/api",
    requiresApiKey: false,
    category: "general",
    testEndpoint: async (endpoint: string): Promise<EndpointTestResult> => ({
      ok: true,
      statusCode: 200,
      latencyMs: 120,
      endpointUrl: endpoint,
      payloadPreview: { test: true },
      detectedVocabularies: [],
    }),
    search: async () => [],
    fetchTerms: async () => [],
  }

  assert.equal(mockProvider.id, "mock")
  assert.equal(mockProvider.category, "general")
  const result = await mockProvider.testEndpoint("https://example.com/api")
  assert.equal(result.ok, true)
  assert.equal(result.latencyMs, 120)
})
