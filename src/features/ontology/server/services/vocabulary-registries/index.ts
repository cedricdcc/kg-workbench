import { getRegistryProvider } from "./providers"
import { fetchOlsTerms, parseOlsTerm } from "./ols4-client"
import { fetchLovTerms, parseLovTerm } from "./lov-client"
import type { RegistryTerm } from "./types"

export * from "./types"
export * from "./providers"
export * from "./aggregator"
export type * from "./domain-discovery"
export { parseOlsTerm, parseLovTerm }

export async function fetchRegistryTerms(
  source: string,
  sourceId: string,
  options?: { apiKey?: string; endpoint?: string }
): Promise<RegistryTerm[]> {
  const provider = getRegistryProvider(source)
  if (provider) {
    const terms = await provider.fetchTerms(sourceId, options)
    if (terms && terms.length > 0) {
      return terms
    }
  }

  if (source === "ols" || source === "ols4") {
    return fetchOlsTerms(sourceId)
  }
  if (source === "lov") {
    return fetchLovTerms(sourceId)
  }

  return []
}
