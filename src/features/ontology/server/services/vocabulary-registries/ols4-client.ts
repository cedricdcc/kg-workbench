import type { RegistrySearchResult, RegistryTerm } from "./types"

const OLS_BASE = "https://www.ebi.ac.uk/ols4/api"
const TIMEOUT_MS = 10000

export function parseOlsTerm(raw: any): RegistryTerm {
  const oboId: string = raw.obo_id || raw.short_form || ""
  let curie = oboId.replace(/_/g, ":")
  if (!curie.includes(":") && raw.iri) {
    const parts = raw.iri.split(/[\/#]/)
    const last = parts[parts.length - 1]
    const prefix = raw.ontology_name || "term"
    curie = `${prefix}:${last}`
  } else if (curie.includes(":")) {
    const [p, ...rest] = curie.split(":")
    curie = `${p.toLowerCase()}:${rest.join(":")}`
  }

  const label: string =
    typeof raw.label === "string"
      ? raw.label
      : Array.isArray(raw.label) && raw.label[0]
        ? raw.label[0]
        : curie

  let description = ""
  if (Array.isArray(raw.description) && raw.description[0]) {
    description = raw.description[0]
  } else if (typeof raw.description === "string") {
    description = raw.description
  }

  const synonyms: string[] = Array.isArray(raw.synonyms)
    ? raw.synonyms.filter(Boolean)
    : []

  const parentIris: string[] = []
  if (raw._links?.parents?.href) {
    // Links exist, or direct hierarchical properties
  }
  if (Array.isArray(raw.subClassOf)) {
    for (const parent of raw.subClassOf) {
      if (typeof parent === "string") parentIris.push(parent)
      else if (parent?.iri) parentIris.push(parent.iri)
    }
  }

  let type: "class" | "property" | "individual" = "class"
  if (raw.type === "property" || raw.is_defining_ontology === false) {
    type = "property"
  }

  return {
    curie,
    iri: raw.iri || "",
    label,
    type,
    description,
    synonyms,
    parentIris,
    relatedPropertyIris: [],
  }
}

export async function searchOls(query: string): Promise<RegistrySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${OLS_BASE}/search?q=${encodeURIComponent(trimmed)}&type=ontology&rows=10`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (!res.ok) return []
    const data = await res.json()
    const docs = data.response?.docs || []

    return docs.map((doc: any): RegistrySearchResult => {
      const prefix = (doc.ontology_name || doc.id || "").toLowerCase()
      const title = doc.config?.title || doc.title || prefix.toUpperCase()
      const description = doc.config?.description || doc.description || ""
      const baseIri =
        doc.config?.baseUris?.[0] || doc.config?.id || `http://purl.obolibrary.org/obo/${prefix}.owl`

      return {
        source: "ols",
        sourceId: prefix,
        prefix,
        name: title,
        description,
        baseIri,
      }
    })
  } catch (err) {
    console.error("OLS search failed:", err)
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchOlsTerms(ontologyId: string): Promise<RegistryTerm[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const url = `${OLS_BASE}/ontologies/${encodeURIComponent(ontologyId.toLowerCase())}/terms?size=300`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (!res.ok) return []
    const data = await res.json()
    const rawTerms = data._embedded?.terms || []

    return rawTerms.map(parseOlsTerm)
  } catch (err) {
    console.error(`Failed to fetch terms for OLS ontology ${ontologyId}:`, err)
    return []
  } finally {
    clearTimeout(timer)
  }
}
