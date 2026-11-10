import { getRegistryProvider } from "./ohi-provider"
import {
  searchOhiPackages,
  type SearchOhiOptions,
} from "../../ohi/catalog-client"
import { getBuiltinPublication } from "../../ohi/builtin-publications"
import type { RegistrySearchResult } from "./types"

export interface SearchRegistriesOptions {
  enabledProviderIds?: string[]
  timeoutMs?: number
  limitPerProvider?: number
  limit?: number
  apiKeys?: Record<string, string>
  catalogUrl?: string
  offlineOnly?: boolean
}

export interface MultiRegistrySearchResponse {
  results: RegistrySearchResult[]
  failedProviders: Array<{ providerId: string; error: string }>
}

/**
 * Searches registries across enabled provider targets, routing to ohi.dev catalog with deduplication.
 */
export async function searchAllRegistries(
  query: string,
  options?: SearchRegistriesOptions
): Promise<MultiRegistrySearchResponse> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { results: [], failedProviders: [] }
  }

  const limit = options?.limitPerProvider || options?.limit || 20
  const providerIds =
    options?.enabledProviderIds && options.enabledProviderIds.length > 0
      ? options.enabledProviderIds
      : ["ohi"]

  const searchPromises = providerIds.map(async (providerId) => {
    const provider = getRegistryProvider(providerId)
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`)
    }

    const opts: SearchOhiOptions = {
      limit,
      catalogUrl: options?.catalogUrl,
      offlineOnly: options?.offlineOnly,
    }

    const packages = await searchOhiPackages(trimmed, opts)
    const results: RegistrySearchResult[] = packages.map((pkg) => {
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

    return {
      providerId,
      results,
    }
  })

  const settled = await Promise.allSettled(searchPromises)
  const combinedResults: RegistrySearchResult[] = []
  const failedProviders: Array<{ providerId: string; error: string }> = []
  const seenPrefixes = new Set<string>()

  for (let i = 0; i < settled.length; i++) {
    const res = settled[i]
    const requestedId = providerIds[i]

    if (res.status === "fulfilled") {
      for (const item of res.value.results) {
        const key = item.prefix.toLowerCase()
        if (!seenPrefixes.has(key)) {
          seenPrefixes.add(key)
          combinedResults.push(item)
        }
      }
    } else {
      failedProviders.push({
        providerId: requestedId,
        error:
          res.reason instanceof Error ? res.reason.message : String(res.reason),
      })
    }
  }

  return {
    results: combinedResults,
    failedProviders,
  }
}

/**
 * Convenience wrapper returning a flat array of RegistrySearchResult.
 */
export async function searchRegistries(
  query: string,
  options?: SearchRegistriesOptions
): Promise<RegistrySearchResult[]> {
  const response = await searchAllRegistries(query, options)
  return response.results
}
