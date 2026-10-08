import type { RegistrySearchResult, RegistryTerm } from "./types"

const LOV_BASE = "https://lov.linkeddata.es/dataset/api/v2"
const TIMEOUT_MS = 10000

export interface LovCatalogItem {
  uri: string
  nsp?: string
  prefix: string
  titles?: Array<{ value: string; lang?: string }>
}

interface LovTermRecord {
  prefixedName?: string
  qname?: string
  uri?: string
  label?: string
  labels?: Array<{ value?: string }>
  comment?: string
  comments?: Array<{ value?: string }>
  description?: string
  type?: string
  _source?: LovTermRecord
}

interface LovVocabRecord {
  prefix?: string
  uri?: string
  title?: string
  titles?: Array<{ value?: string }>
  description?: string
  descriptions?: Array<{ value?: string }>
  _source?: Record<string, unknown>
}

let cachedCatalog: LovCatalogItem[] | null = null
let catalogCacheTimestamp = 0
const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function fetchLovCatalog(): Promise<LovCatalogItem[]> {
  const now = Date.now()
  if (cachedCatalog && now - catalogCacheTimestamp < CATALOG_CACHE_TTL_MS) {
    return cachedCatalog
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${LOV_BASE}/vocabulary/list`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!res.ok) {
      return cachedCatalog || []
    }
    const data = (await res.json()) as LovCatalogItem[]
    if (Array.isArray(data)) {
      cachedCatalog = data
      catalogCacheTimestamp = now
      return data
    }
    return cachedCatalog || []
  } catch (err) {
    console.error("Failed to fetch LOV vocabulary catalog:", err)
    return cachedCatalog || []
  } finally {
    clearTimeout(timer)
  }
}

export function parseLovTerm(raw: LovTermRecord): RegistryTerm {
  const curie = raw.prefixedName || raw.qname || ""
  const iri = raw.uri || ""
  const rawLabel =
    raw.label || (Array.isArray(raw.labels) && raw.labels[0]?.value) || ""
  const label = rawLabel || (curie.includes(":") ? curie.split(":")[1] : curie)

  const description =
    raw.comment ||
    (Array.isArray(raw.comments) && raw.comments[0]?.value) ||
    raw.description ||
    ""

  const rawType = (raw.type || "").toLowerCase()
  const type = rawType.includes("prop") ? "property" : "class"

  return {
    curie,
    iri,
    label,
    type,
    description,
    synonyms: [],
    parentIris: [],
    relatedPropertyIris: [],
  }
}

function extractLovTitle(raw: Record<string, unknown>): string {
  if (typeof raw.title === "string" && raw.title.trim()) return raw.title.trim()
  if (Array.isArray(raw.titles) && raw.titles[0]?.value)
    return raw.titles[0].value
  for (const [key, val] of Object.entries(raw)) {
    if (key.includes("title") && typeof val === "string" && val.trim()) {
      return val.trim()
    }
  }
  return ""
}

function extractLovDescription(raw: Record<string, unknown>): string {
  if (typeof raw.description === "string" && raw.description.trim())
    return raw.description.trim()
  if (Array.isArray(raw.descriptions) && raw.descriptions[0]?.value)
    return raw.descriptions[0].value
  for (const [key, val] of Object.entries(raw)) {
    if (key.includes("description") && typeof val === "string" && val.trim()) {
      return val.trim()
    }
  }
  return ""
}

export async function searchLov(
  query: string
): Promise<RegistrySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const lowerQuery = trimmed.toLowerCase()

  // 1. Fetch cached LOV 920-vocabulary catalog
  const catalogPromise = fetchLovCatalog()

  // 2. Query LOV API search endpoint
  const searchApiPromise = (async (): Promise<RegistrySearchResult[]> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const url = `${LOV_BASE}/vocabulary/search?q=${encodeURIComponent(trimmed)}`
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
      if (!res.ok) return []
      const data = await res.json()
      const results = (data.results || []) as LovVocabRecord[]

      return results.map((item): RegistrySearchResult => {
        const source = (item._source || item) as Record<string, unknown>
        const prefix = (
          (source.prefix as string) ||
          item.prefix ||
          ""
        ).toLowerCase()
        const title =
          extractLovTitle(source) ||
          extractLovTitle(item as Record<string, unknown>) ||
          prefix.toUpperCase()
        const description =
          extractLovDescription(source) ||
          extractLovDescription(item as Record<string, unknown>) ||
          ""
        const baseIri =
          (source.uri as string) ||
          (source.nsp as string) ||
          item.uri ||
          `http://purl.org/${prefix}/`

        return {
          source: "lov",
          sourceId: prefix,
          prefix,
          name: title,
          description,
          baseIri,
        }
      })
    } catch (err) {
      console.error("LOV API search failed:", err)
      return []
    } finally {
      clearTimeout(timer)
    }
  })()

  const [catalog, apiResults] = await Promise.all([
    catalogPromise,
    searchApiPromise,
  ])

  // Filter catalog by prefix and title
  const exactPrefixMatches: RegistrySearchResult[] = []
  const startsWithMatches: RegistrySearchResult[] = []
  const otherMatches: RegistrySearchResult[] = []

  for (const item of catalog) {
    const p = (item.prefix || "").toLowerCase()
    const title = (item.titles?.[0]?.value || "").trim() || p.toUpperCase()
    const lowerTitle = title.toLowerCase()
    const uri = item.uri || item.nsp || `http://purl.org/${p}/`

    const result: RegistrySearchResult = {
      source: "lov",
      sourceId: p,
      prefix: p,
      name: title,
      description: "",
      baseIri: uri,
    }

    if (p === lowerQuery) {
      exactPrefixMatches.push(result)
    } else if (p.startsWith(lowerQuery)) {
      startsWithMatches.push(result)
    } else if (lowerTitle.includes(lowerQuery) || p.includes(lowerQuery)) {
      otherMatches.push(result)
    }
  }

  // Combine results with prioritized ranking:
  // 1. Exact catalog prefix matches
  // 2. Starts-with catalog prefix matches
  // 3. API search results (which often include rich descriptions)
  // 4. Other catalog matches
  const mergedMap = new Map<string, RegistrySearchResult>()

  function insertResult(item: RegistrySearchResult) {
    if (!item.prefix) return
    const key = item.prefix.toLowerCase()
    const existing = mergedMap.get(key)
    if (!existing) {
      mergedMap.set(key, item)
    } else {
      if (!existing.description && item.description) {
        existing.description = item.description
      }
      if (
        existing.name === existing.prefix.toUpperCase() &&
        item.name !== item.prefix.toUpperCase()
      ) {
        existing.name = item.name
      }
      if (!existing.baseIri && item.baseIri) {
        existing.baseIri = item.baseIri
      }
    }
  }

  for (const item of exactPrefixMatches) insertResult(item)
  for (const item of startsWithMatches.slice(0, 5)) insertResult(item)
  for (const item of apiResults) insertResult(item)
  for (const item of otherMatches.slice(0, 10)) insertResult(item)

  return Array.from(mergedMap.values()).slice(0, 15)
}

export async function fetchLovTerms(prefix: string): Promise<RegistryTerm[]> {
  const p = prefix.trim().toLowerCase()
  if (!p) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${LOV_BASE}/term/search?q=${encodeURIComponent(p)}&vocab=${encodeURIComponent(p)}&page_size=100`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (!res.ok) return []
    const data = await res.json()
    const rawResults = (data.results || []) as LovTermRecord[]

    return rawResults.map((r) => parseLovTerm(r._source || r))
  } catch (err) {
    console.error(`Failed to fetch terms for LOV vocabulary ${prefix}:`, err)
    return []
  } finally {
    clearTimeout(timer)
  }
}
