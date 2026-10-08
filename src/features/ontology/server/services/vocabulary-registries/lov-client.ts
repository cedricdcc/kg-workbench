import type { RegistrySearchResult, RegistryTerm } from "./types"

const LOV_BASE = "https://lov.linkeddata.es/dataset/lov/api/v2"
const TIMEOUT_MS = 10000

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
  _source?: {
    prefix?: string
    uri?: string
  }
}

export function parseLovTerm(raw: LovTermRecord): RegistryTerm {
  const curie = raw.prefixedName || raw.qname || ""
  const iri = raw.uri || ""
  const label =
    raw.label ||
    (Array.isArray(raw.labels) && raw.labels[0]?.value) ||
    curie.split(":")[1] ||
    curie

  const description =
    raw.comment ||
    (Array.isArray(raw.comments) && raw.comments[0]?.value) ||
    raw.description ||
    ""

  const type =
    raw.type === "property" || raw.type === "Property" ? "property" : "class"

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

export async function searchLov(query: string): Promise<RegistrySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

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

    return results.slice(0, 10).map((item): RegistrySearchResult => {
      const prefix = (item.prefix || item._source?.prefix || "").toLowerCase()
      const title =
        (Array.isArray(item.titles) && item.titles[0]?.value) ||
        item.title ||
        prefix.toUpperCase()
      const description =
        (Array.isArray(item.descriptions) && item.descriptions[0]?.value) ||
        item.description ||
        ""
      const baseIri = item.uri || item._source?.uri || `http://purl.org/${prefix}/`

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
    console.error("LOV search failed:", err)
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchLovTerms(prefix: string): Promise<RegistryTerm[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${LOV_BASE}/term/search?vocab=${encodeURIComponent(prefix)}`
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
