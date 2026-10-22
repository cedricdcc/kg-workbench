import type {
  EndpointTestResult,
  RegistryFetchOptions,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"
import { fetchLovTerms, parseLovTerm, searchLov } from "../lov-client"

const LOV_BASE = "https://lov.linkeddata.es/dataset/api/v2"
const TIMEOUT_MS = 3000

let isCircuitOpen = false
let circuitLastTripped = 0
const CIRCUIT_COOLDOWN_MS = 60 * 1000 // 1 minute cooldown

export class LovProvider implements VocabularyRegistryProvider {
  readonly id = "lov"
  readonly name = "Linked Open Vocabularies (LOV)"
  readonly defaultEndpoint = LOV_BASE
  readonly requiresApiKey = false
  readonly category = "general" as const

  private checkCircuit(): boolean {
    if (isCircuitOpen) {
      if (Date.now() - circuitLastTripped > CIRCUIT_COOLDOWN_MS) {
        isCircuitOpen = false
        return true
      }
      return false
    }
    return true
  }

  private tripCircuit() {
    isCircuitOpen = true
    circuitLastTripped = Date.now()
  }

  async testEndpoint(
    endpoint: string = this.defaultEndpoint,
    _apiKey?: string,
    query = "sosa"
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    if (!this.checkCircuit()) {
      return {
        ok: false,
        statusCode: 503,
        latencyMs: 0,
        endpointUrl: endpoint,
        payloadPreview: null,
        detectedVocabularies: [],
        error: "LOV circuit breaker active (service previously timed out or unreachable)",
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const url = `${endpoint.replace(/\/+$/, "")}/vocabulary/search?q=${encodeURIComponent(query)}`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
      const latencyMs = Math.round(performance.now() - startTime)

      if (!res.ok) {
        this.tripCircuit()
        return {
          ok: false,
          statusCode: res.status,
          latencyMs,
          endpointUrl: url,
          payloadPreview: null,
          detectedVocabularies: [],
          error: `HTTP ${res.status}: ${res.statusText}`,
        }
      }

      const data = await res.json()
      const results = (data.results || []) as Array<{
        prefix?: string
        uri?: string
        titles?: Array<{ value?: string }>
        descriptions?: Array<{ value?: string }>
      }>

      const detectedVocabularies: RegistrySearchResult[] = results.map((item) => ({
        source: "lov",
        sourceId: item.prefix || "",
        prefix: (item.prefix || "").toLowerCase(),
        name: item.titles?.[0]?.value || item.prefix?.toUpperCase() || "VOCAB",
        description: item.descriptions?.[0]?.value || "",
        baseIri: item.uri || `http://purl.org/${item.prefix}/`,
      }))

      return {
        ok: true,
        statusCode: res.status,
        latencyMs,
        endpointUrl: url,
        payloadPreview: data,
        detectedVocabularies,
      }
    } catch (err) {
      this.tripCircuit()
      const latencyMs = Math.round(performance.now() - startTime)
      return {
        ok: false,
        statusCode: 0,
        latencyMs,
        endpointUrl: endpoint,
        payloadPreview: null,
        detectedVocabularies: [],
        error: err instanceof Error ? err.message : "Failed to connect to LOV",
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async search(
    query: string,
    _options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]> {
    if (!this.checkCircuit()) {
      return []
    }
    try {
      return await searchLov(query)
    } catch {
      this.tripCircuit()
      return []
    }
  }

  async fetchTerms(
    ontologyId: string,
    _options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]> {
    return fetchLovTerms(ontologyId)
  }
}
export { parseLovTerm }
