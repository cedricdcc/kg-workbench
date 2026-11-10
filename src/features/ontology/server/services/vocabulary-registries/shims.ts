import type { RegistryTerm } from "./types"

export interface OlsRawTerm {
  obo_id?: string
  short_form?: string
  iri?: string
  ontology_name?: string
  label?: string | string[]
  description?: string | string[]
  synonyms?: string[]
  subClassOf?: Array<string | { iri?: string }>
  type?: string
  is_defining_ontology?: boolean
  _links?: {
    parents?: { href?: string }
  }
}

export interface LovTermRecord {
  prefixedName?: string
  qname?: string
  uri?: string
  label?: string
  labels?: Array<{ value?: string }>
  comment?: string
  comments?: Array<{ value?: string }>
  description?: string
  descriptions?: Array<{ value?: string }>
  type?: string
}

/**
 * Lightweight parser shim for OLS terms to retain backward compatibility.
 */
export function parseOlsTerm(raw: OlsRawTerm): RegistryTerm {
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

/**
 * Lightweight parser shim for LOV terms to retain backward compatibility.
 */
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
