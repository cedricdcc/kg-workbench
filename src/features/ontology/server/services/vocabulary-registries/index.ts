import { fetchOlsTerms, parseOlsTerm, searchOls } from "./ols4-client"
import { fetchLovTerms, parseLovTerm, searchLov } from "./lov-client"
import type { RegistrySearchResult, RegistryTerm } from "./types"

export * from "./types"
export { parseOlsTerm, parseLovTerm }

export async function searchRegistries(query: string): Promise<RegistrySearchResult[]> {
  const [olsResults, lovResults] = await Promise.all([
    searchOls(query),
    searchLov(query),
  ])

  // Combine and deduplicate by prefix
  const seen = new Set<string>()
  const combined: RegistrySearchResult[] = []

  for (const item of [...olsResults, ...lovResults]) {
    const key = item.prefix.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(item)
    }
  }

  return combined
}

export async function fetchRegistryTerms(
  source: "ols" | "lov",
  sourceId: string
): Promise<RegistryTerm[]> {
  if (source === "ols") {
    return fetchOlsTerms(sourceId)
  }
  return fetchLovTerms(sourceId)
}
