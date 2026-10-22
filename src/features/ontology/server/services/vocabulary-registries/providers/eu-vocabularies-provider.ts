import type {
  EndpointTestResult,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"

const EU_SPARQL_ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql"
const TIMEOUT_MS = 4000

interface SparqlBinding {
  concept?: { value: string }
  prefLabel?: { value: string }
  definition?: { value: string }
}

export class EuVocabulariesProvider implements VocabularyRegistryProvider {
  readonly id = "eu_vocabularies"
  readonly name = "EU Vocabularies & EuroVoc (Public Sector)"
  readonly defaultEndpoint = EU_SPARQL_ENDPOINT
  readonly requiresApiKey = false
  readonly category = "eu_public" as const

  async testEndpoint(
    endpoint: string = this.defaultEndpoint,
    _apiKey?: string,
    query = "energy"
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const sparql = `
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT DISTINCT ?concept ?prefLabel ?definition WHERE {
          ?concept a skos:Concept ;
                   skos:prefLabel ?prefLabel .
          OPTIONAL { ?concept skos:definition ?definition }
          FILTER(regex(str(?prefLabel), "${query}", "i"))
          FILTER(lang(?prefLabel) = "en")
        } LIMIT 5
      `
      const url = `${endpoint}?query=${encodeURIComponent(sparql)}&format=application%2Fsparql-results%2Bjson`

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/sparql-results+json, application/json" },
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
      const bindings = (data?.results?.bindings || []) as SparqlBinding[]

      const detectedVocabularies: RegistrySearchResult[] = bindings.map((b, idx) => {
        const uri = b.concept?.value || ""
        const label = b.prefLabel?.value || `Concept ${idx + 1}`
        const desc = b.definition?.value || "EuroVoc / EU Controlled Concept"
        const prefix = "eurovoc"

        return {
          source: "eu_vocabularies",
          sourceId: uri || `eurovoc-${idx}`,
          prefix: `${prefix}-${idx + 1}`,
          name: label,
          description: desc,
          baseIri: uri || "http://eurovoc.europa.eu/",
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
        error: err instanceof Error ? err.message : "Failed to connect to EU Vocabularies SPARQL",
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async search(
    query: string,
    options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]> {
    const testResult = await this.testEndpoint(options?.endpoint, options?.apiKey, query)
    return testResult.ok ? testResult.detectedVocabularies : []
  }

  async fetchTerms(): Promise<RegistryTerm[]> {
    return []
  }
}
