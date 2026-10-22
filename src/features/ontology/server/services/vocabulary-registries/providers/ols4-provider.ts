import type {
  EndpointTestResult,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"
import { fetchOlsTerms, parseOlsTerm, searchOls } from "../ols4-client"

const OLS_BASE = "https://www.ebi.ac.uk/ols4/api"
const TIMEOUT_MS = 4000

export class Ols4Provider implements VocabularyRegistryProvider {
  readonly id = "ols4"
  readonly name = "EMBL-EBI OLS4 (Ontology Lookup Service)"
  readonly defaultEndpoint = OLS_BASE
  readonly requiresApiKey = false
  readonly category = "biomedical" as const

  async testEndpoint(
    endpoint: string = this.defaultEndpoint,
    _apiKey?: string,
    query = "sosa"
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const url = `${endpoint.replace(/\/+$/, "")}/search?q=${encodeURIComponent(query)}&type=ontology&rows=5`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
      const latencyMs = Math.round(performance.now() - startTime)

      if (!res.ok) {
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
      const docs = (data.response?.docs || []) as Array<{
        ontology_name?: string
        id?: string
        title?: string
        description?: string
        config?: { title?: string; description?: string; baseUris?: string[]; id?: string }
      }>

      const detectedVocabularies: RegistrySearchResult[] = docs.map((doc) => {
        const prefix = (doc.ontology_name || doc.id || "").toLowerCase()
        const title = doc.config?.title || doc.title || prefix.toUpperCase()
        const description = doc.config?.description || doc.description || ""
        const baseIri =
          doc.config?.baseUris?.[0] || doc.config?.id || `http://purl.obolibrary.org/obo/${prefix}.owl`

        return {
          source: "ols4",
          sourceId: prefix,
          prefix,
          name: title,
          description,
          baseIri,
        }
      })

      return {
        ok: true,
        statusCode: res.status,
        latencyMs,
        endpointUrl: url,
        payloadPreview: data,
        detectedVocabularies,
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
        error: err instanceof Error ? err.message : "Failed to connect to OLS4",
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async search(query: string): Promise<RegistrySearchResult[]> {
    const results = await searchOls(query)
    return results.map((r) => ({ ...r, source: "ols4" }))
  }

  async fetchTerms(ontologyId: string): Promise<RegistryTerm[]> {
    return fetchOlsTerms(ontologyId)
  }
}
export { parseOlsTerm }
