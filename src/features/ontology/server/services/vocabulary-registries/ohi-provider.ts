import {
  searchOhiPackages,
  type SearchOhiOptions,
} from "../../ohi/catalog-client"
import { getBuiltinPublication } from "../../ohi/builtin-publications"
import type {
  EndpointTestResult,
  RegistryFetchOptions,
  RegistrySearchOptions,
  RegistrySearchResult,
  RegistryTerm,
  VocabularyRegistryProvider,
} from "./types"

export class OhiRegistryProvider implements VocabularyRegistryProvider {
  readonly id = "ohi"
  readonly name = "ohi.dev Package Catalog"
  readonly defaultEndpoint = "https://ohi.dev"
  readonly requiresApiKey = false
  readonly category = "general" as const

  async testEndpoint(
    endpoint: string,
    apiKey?: string,
    query?: string
  ): Promise<EndpointTestResult> {
    const start = Date.now()
    const targetUrl = endpoint || this.defaultEndpoint
    const testQuery = query?.trim() || "prov"

    try {
      const results = await this.search(testQuery, {
        endpoint: targetUrl,
        apiKey,
        limit: 5,
      })
      const latencyMs = Date.now() - start
      return {
        ok: true,
        statusCode: 200,
        latencyMs,
        endpointUrl: targetUrl,
        payloadPreview: {
          packages: results.map((r) => ({
            package_ref: r.sourceId,
            prefix: r.prefix,
            name: r.name,
          })),
        },
        detectedVocabularies: results,
      }
    } catch (err) {
      const latencyMs = Date.now() - start
      return {
        ok: false,
        statusCode: 500,
        latencyMs,
        endpointUrl: targetUrl,
        payloadPreview: null,
        detectedVocabularies: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async search(
    query: string,
    options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]> {
    const opts: SearchOhiOptions = {
      limit: options?.limit ?? 10,
      catalogUrl: options?.endpoint,
    }
    const packages = await searchOhiPackages(query, opts)
    return packages.map((pkg) => {
      const builtin = getBuiltinPublication(pkg.package_ref)
      const baseIri =
        builtin?.metadata.base_url ||
        `https://ohi.dev/${pkg.namespace}/${pkg.name}`

      return {
        source: "ohi",
        sourceId: `${pkg.namespace}/${pkg.name}`,
        prefix: pkg.name,
        name: pkg.title || pkg.name,
        description: pkg.description || "",
        baseIri,
      }
    })
  }

  async fetchTerms(
    ontologyId: string,
    options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]> {
    const { fetchRegistryTerms } = await import("./index")
    return fetchRegistryTerms("ohi", ontologyId, {
      apiKey: options?.apiKey,
      endpoint: options?.endpoint,
    })
  }
}

const defaultOhiProvider = new OhiRegistryProvider()

const KNOWN_PROVIDER_IDS = new Set([
  "ohi",
  "custom",
  "ols",
  "ols4",
  "bartoc",
  "agroportal",
  "bioportal",
  "ecoportal",
  "eu_vocabularies",
  "lov",
])

export function getRegistryProvider(
  id: string
): VocabularyRegistryProvider | undefined {
  const normalized = id.toLowerCase().trim()
  if (KNOWN_PROVIDER_IDS.has(normalized)) {
    return defaultOhiProvider
  }
  return undefined
}

export function listRegistryProviders(): VocabularyRegistryProvider[] {
  return [defaultOhiProvider]
}
