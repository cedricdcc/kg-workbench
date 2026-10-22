import type {
  EndpointTestResult,
  RegistryFetchOptions,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "../types"

const TIMEOUT_MS = 4000

export interface OntoPortalDoc {
  acronym?: string
  name?: string
  description?: string
  "@id"?: string
  ui?: string
  ontology?: {
    acronym?: string
    name?: string
  }
  [key: string]: unknown
}

export function parseOntoPortalDoc(
  doc: OntoPortalDoc,
  providerId: string
): RegistrySearchResult {
  const acronym = doc.acronym || doc.ontology?.acronym || ""
  const prefix = acronym.toLowerCase()
  const name = doc.name || doc.ontology?.name || prefix.toUpperCase()
  const description = typeof doc.description === "string" ? doc.description : ""
  const baseIri = doc["@id"] || `https://${providerId}.org/ontologies/${prefix.toUpperCase()}`

  return {
    source: providerId,
    sourceId: prefix,
    prefix,
    name,
    description,
    baseIri,
  }
}

export interface OntoPortalConfig {
  id: string
  name: string
  defaultEndpoint: string
  requiresApiKey: boolean
  category: "general" | "biomedical" | "agri_eco"
}

export class OntoPortalProvider implements VocabularyRegistryProvider {
  readonly id: string
  readonly name: string
  readonly defaultEndpoint: string
  readonly requiresApiKey: boolean
  readonly category: "general" | "biomedical" | "agri_eco"

  constructor(config: OntoPortalConfig) {
    this.id = config.id
    this.name = config.name
    this.defaultEndpoint = config.defaultEndpoint
    this.requiresApiKey = config.requiresApiKey
    this.category = config.category
  }

  private buildHeaders(apiKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      Accept: "application/json",
    }
    if (apiKey) {
      headers["Authorization"] = `apikey token=${apiKey.trim()}`
    }
    return headers
  }

  async testEndpoint(
    endpoint: string = this.defaultEndpoint,
    apiKey?: string,
    query = "crop"
  ): Promise<EndpointTestResult> {
    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const cleanEndpoint = endpoint.replace(/\/+$/, "")
      const apiKeyParam = apiKey ? `&apikey=${encodeURIComponent(apiKey.trim())}` : ""
      const url = `${cleanEndpoint}/search?q=${encodeURIComponent(query)}&pagesize=5${apiKeyParam}`

      const res = await fetch(url, {
        signal: controller.signal,
        headers: this.buildHeaders(apiKey),
      })
      const latencyMs = Math.round(performance.now() - startTime)

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}: ${res.statusText}`
        if (res.status === 401) {
          errorMsg = "Authentication required. Please configure an API key for this OntoPortal instance."
        }
        return {
          ok: false,
          statusCode: res.status,
          latencyMs,
          endpointUrl: url,
          payloadPreview: null,
          detectedVocabularies: [],
          error: errorMsg,
        }
      }

      const data = await res.json()
      const collection = Array.isArray(data)
        ? data
        : Array.isArray(data.collection)
          ? data.collection
          : []

      const detectedVocabularies = collection.map((item: OntoPortalDoc) =>
        parseOntoPortalDoc(item, this.id)
      )

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
        error: err instanceof Error ? err.message : `Failed to connect to ${this.name}`,
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
    const apiKey = options?.apiKey

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const cleanEndpoint = endpoint.replace(/\/+$/, "")
      const apiKeyParam = apiKey ? `&apikey=${encodeURIComponent(apiKey.trim())}` : ""
      const url = `${cleanEndpoint}/search?q=${encodeURIComponent(trimmed)}&pagesize=${limit}${apiKeyParam}`

      const res = await fetch(url, {
        signal: controller.signal,
        headers: this.buildHeaders(apiKey),
      })

      if (!res.ok) return []
      const data = await res.json()
      const collection = Array.isArray(data)
        ? data
        : Array.isArray(data.collection)
          ? data.collection
          : []

      return collection.map((item: OntoPortalDoc) =>
        parseOntoPortalDoc(item, this.id)
      )
    } catch (err) {
      console.warn(`${this.name} search failed:`, err)
      return []
    } finally {
      clearTimeout(timeout)
    }
  }

  async fetchTerms(
    ontologyId: string,
    options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]> {
    const endpoint = options?.endpoint || this.defaultEndpoint
    const apiKey = options?.apiKey
    const timeoutMs = options?.timeoutMs || TIMEOUT_MS

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const cleanEndpoint = endpoint.replace(/\/+$/, "")
      const apiKeyParam = apiKey ? `?apikey=${encodeURIComponent(apiKey.trim())}` : ""
      const url = `${cleanEndpoint}/ontologies/${encodeURIComponent(ontologyId.toUpperCase())}/classes${apiKeyParam}`

      const res = await fetch(url, {
        signal: controller.signal,
        headers: this.buildHeaders(apiKey),
      })

      if (!res.ok) return []
      const data = await res.json()
      const collection = Array.isArray(data)
        ? data
        : Array.isArray(data.collection)
          ? data.collection
          : []

      return collection.slice(0, 300).map((c: Record<string, unknown>) => {
        const prefLabel = (c.prefLabel as string) || (c.label as string) || ""
        const id = (c["@id"] as string) || ""
        const curie = id.includes("#")
          ? `${ontologyId.toLowerCase()}:${id.split("#")[1]}`
          : `${ontologyId.toLowerCase()}:${id.split("/").pop()}`

        return {
          curie,
          iri: id,
          label: prefLabel || curie,
          type: "class" as const,
          description: (c.definition as string) || "",
          synonyms: Array.isArray(c.synonym) ? (c.synonym as string[]) : [],
          parentIris: [],
          relatedPropertyIris: [],
        }
      })
    } catch (err) {
      console.warn(`Failed to fetch terms for ${this.name} ${ontologyId}:`, err)
      return []
    } finally {
      clearTimeout(timeout)
    }
  }
}
