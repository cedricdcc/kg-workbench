import type {
  EndpointTestResult,
  RegistryFetchOptions,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"

const TIMEOUT_MS = 5000

export class CustomProvider implements VocabularyRegistryProvider {
  readonly id = "custom"
  readonly name = "Custom Registry (REST or SPARQL)"
  readonly defaultEndpoint = "https://"
  readonly requiresApiKey = false
  readonly category = "custom" as const

  async testEndpoint(
    endpoint: string,
    apiKey?: string,
    _query?: string
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    if (!endpoint || endpoint === "https://") {
      return {
        ok: false,
        statusCode: 400,
        latencyMs: 0,
        endpointUrl: endpoint,
        payloadPreview: null,
        detectedVocabularies: [],
        error: "Please provide a valid endpoint URL",
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const headers: Record<string, string> = {
        Accept: "application/json, application/sparql-results+json, text/turtle, */*",
      }
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`
      }

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers,
      })
      const latencyMs = Math.round(performance.now() - startTime)

      const contentType = res.headers.get("content-type") || ""
      let payloadPreview: unknown = null

      if (contentType.includes("json")) {
        try {
          payloadPreview = await res.json()
        } catch {
          payloadPreview = "(Invalid JSON)"
        }
      } else {
        const text = await res.text()
        payloadPreview = text.slice(0, 2000)
      }

      return {
        ok: res.ok,
        statusCode: res.status,
        latencyMs,
        endpointUrl: endpoint,
        payloadPreview,
        detectedVocabularies: [],
        error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime)
      return {
        ok: false,
        statusCode: 0,
        latencyMs,
        endpointUrl: endpoint,
        payloadPreview: null,
        detectedVocabularies: [],
        error: err instanceof Error ? err.message : "Failed to connect to custom endpoint",
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async search(
    _query: string,
    _options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]> {
    return []
  }

  async fetchTerms(
    _ontologyId: string,
    _options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]> {
    return []
  }
}
