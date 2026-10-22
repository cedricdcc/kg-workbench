import type {
  EndpointTestResult,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"

const BARTOC_DEFAULT_ENDPOINT = "https://bartoc.org/api/voc"
const TIMEOUT_MS = 4000

export interface BartocJskosRecord {
  uri?: string
  prefLabel?: Record<string, string>
  notation?: string[]
  scopeNote?: Record<string, string[]>
  definition?: Record<string, string[]>
  url?: string
  type?: string[]
  [key: string]: unknown
}

function extractLabel(prefLabel?: Record<string, string>): string {
  if (!prefLabel) return ""
  return prefLabel.en || Object.values(prefLabel)[0] || ""
}

function extractDescription(
  record: BartocJskosRecord
): string {
  if (record.scopeNote) {
    const list = record.scopeNote.en || Object.values(record.scopeNote)[0]
    if (Array.isArray(list) && list[0]) return list[0]
  }
  if (record.definition) {
    const list = record.definition.en || Object.values(record.definition)[0]
    if (Array.isArray(list) && list[0]) return list[0]
  }
  return ""
}

export function parseBartocVocab(raw: BartocJskosRecord): RegistrySearchResult {
  const label = extractLabel(raw.prefLabel)
  const notation = Array.isArray(raw.notation) && raw.notation[0] ? raw.notation[0] : ""
  const prefix = (notation || label.split(/\s+/)[0] || "vocab").toLowerCase().replace(/[^a-z0-9_-]/g, "")
  const description = extractDescription(raw)
  const baseIri = raw.url || raw.uri || `https://bartoc.org/voc/${prefix}`

  return {
    source: "bartoc",
    sourceId: raw.uri || prefix,
    prefix,
    name: label || prefix.toUpperCase(),
    description,
    baseIri,
  }
}

export class BartocProvider implements VocabularyRegistryProvider {
  readonly id = "bartoc"
  readonly name = "BARTOC (Thesauri, Ontologies & Classifications)"
  readonly defaultEndpoint = BARTOC_DEFAULT_ENDPOINT
  readonly requiresApiKey = false
  readonly category = "general" as const

  async testEndpoint(
    endpoint: string = this.defaultEndpoint,
    _apiKey?: string,
    query = "sensor"
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const url = `${endpoint.replace(/\/+$/, "")}?search=${encodeURIComponent(query)}&limit=5`
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

      const data = (await res.json()) as BartocJskosRecord[]
      const detectedVocabularies = Array.isArray(data)
        ? data.map(parseBartocVocab)
        : []

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
        error: err instanceof Error ? err.message : "Failed to connect to BARTOC",
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  async search(
    query: string,
    options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const endpoint = options?.endpoint || this.defaultEndpoint
    const limit = options?.limit || 10
    const timeoutMs = options?.timeoutMs || TIMEOUT_MS

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const url = `${endpoint.replace(/\/+$/, "")}?search=${encodeURIComponent(trimmed)}&limit=${limit}`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })

      if (!res.ok) return []
      const data = (await res.json()) as BartocJskosRecord[]
      if (!Array.isArray(data)) return []

      return data.map(parseBartocVocab)
    } catch (err) {
      console.warn("BARTOC search failed:", err)
      return []
    } finally {
      clearTimeout(timeout)
    }
  }

  async fetchTerms(): Promise<RegistryTerm[]> {
    return []
  }
}
