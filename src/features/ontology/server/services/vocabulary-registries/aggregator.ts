import { getRegistryProvider } from "./providers"
import type { RegistrySearchResult } from "./types"

export interface SearchRegistriesOptions {
  enabledProviderIds?: string[]
  timeoutMs?: number
  limitPerProvider?: number
  apiKeys?: Record<string, string>
}

export interface MultiRegistrySearchResponse {
  results: RegistrySearchResult[]
  failedProviders: Array<{ providerId: string; error: string }>
}

export async function searchAllRegistries(
  query: string,
  options?: SearchRegistriesOptions
): Promise<MultiRegistrySearchResponse> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { results: [], failedProviders: [] }
  }

  const timeoutMs = options?.timeoutMs || 4000
  const limit = options?.limitPerProvider || 10

  const providerIds =
    options?.enabledProviderIds && options.enabledProviderIds.length > 0
      ? options.enabledProviderIds
      : ["ols4", "bartoc", "agroportal", "lov"]

  const searchPromises = providerIds.map(async (providerId) => {
    const provider = getRegistryProvider(providerId)
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`)
    }
    const apiKey = options?.apiKeys?.[providerId]
    return {
      providerId,
      results: await provider.search(trimmed, { limit, timeoutMs, apiKey }),
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
          res.reason instanceof Error
            ? res.reason.message
            : String(res.reason),
      })
    }
  }

  return {
    results: combinedResults,
    failedProviders,
  }
}

export async function searchRegistries(
  query: string,
  options?: SearchRegistriesOptions
): Promise<RegistrySearchResult[]> {
  const response = await searchAllRegistries(query, options)
  return response.results
}
