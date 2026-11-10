import YAML from "yaml"
import { inspectOhiPublication } from "../../ohi/catalog-client"
import { getBuiltinPublication } from "../../ohi/builtin-publications"
import { parseRdfTurtle } from "../vocabulary-ingestion/rdf-parser"
import type { RegistryTerm } from "./types"

export * from "./types"
export * from "./ohi-provider"
export * from "./aggregator"
export * from "./shims"
export type * from "./domain-discovery"

/**
 * Extracts class and slot definitions from a LinkML YAML schema string into standard RegistryTerms.
 */
export function extractTermsFromLinkmlYaml(
  linkmlYaml: string,
  fallbackBaseIri?: string,
  fallbackPrefix?: string
): RegistryTerm[] {
  let doc: Record<string, unknown>
  try {
    doc = (YAML.parse(linkmlYaml) || {}) as Record<string, unknown>
  } catch {
    return []
  }

  const defaultPrefix =
    (typeof doc.default_prefix === "string" && doc.default_prefix) ||
    fallbackPrefix ||
    "term"
  const prefixes = (
    doc.prefixes && typeof doc.prefixes === "object"
      ? (doc.prefixes as Record<string, string>)
      : {}
  ) as Record<string, string>

  let baseIri =
    (typeof doc.id === "string" && doc.id) ||
    prefixes[defaultPrefix] ||
    fallbackBaseIri ||
    `https://ohi.dev/${defaultPrefix}/`

  if (!baseIri.endsWith("#") && !baseIri.endsWith("/")) {
    baseIri += "#"
  }

  const terms: RegistryTerm[] = []

  // Classes
  if (doc.classes && typeof doc.classes === "object") {
    for (const [classKey, classRaw] of Object.entries(doc.classes)) {
      if (!classRaw || typeof classRaw !== "object") continue
      const classDef = classRaw as Record<string, unknown>
      const curie = classKey.includes(":")
        ? classKey
        : `${defaultPrefix}:${classKey}`
      const suffix = classKey.includes(":") ? classKey.split(":")[1] : classKey
      const iri = prefixes[defaultPrefix]
        ? `${prefixes[defaultPrefix]}${suffix}`
        : `${baseIri}${suffix}`
      const label =
        (typeof classDef.title === "string" && classDef.title) ||
        (typeof classDef.name === "string" && classDef.name) ||
        suffix
      const description =
        (typeof classDef.description === "string" && classDef.description) || ""
      const synonyms: string[] = []
      if (Array.isArray(classDef.aliases)) {
        for (const a of classDef.aliases) {
          if (typeof a === "string" && a) synonyms.push(a)
        }
      }
      const parentIris: string[] = []
      if (typeof classDef.is_a === "string" && classDef.is_a) {
        parentIris.push(classDef.is_a)
      }

      terms.push({
        curie,
        iri,
        label,
        type: "class",
        description,
        synonyms,
        parentIris,
        relatedPropertyIris: [],
      })
    }
  }

  // Slots
  if (doc.slots && typeof doc.slots === "object") {
    for (const [slotKey, slotRaw] of Object.entries(doc.slots)) {
      if (!slotRaw || typeof slotRaw !== "object") continue
      const slotDef = slotRaw as Record<string, unknown>
      const curie = slotKey.includes(":")
        ? slotKey
        : `${defaultPrefix}:${slotKey}`
      const suffix = slotKey.includes(":") ? slotKey.split(":")[1] : slotKey
      const iri = prefixes[defaultPrefix]
        ? `${prefixes[defaultPrefix]}${suffix}`
        : `${baseIri}${suffix}`
      const label =
        (typeof slotDef.title === "string" && slotDef.title) ||
        (typeof slotDef.name === "string" && slotDef.name) ||
        suffix
      const description =
        (typeof slotDef.description === "string" && slotDef.description) || ""
      const synonyms: string[] = []
      if (Array.isArray(slotDef.aliases)) {
        for (const a of slotDef.aliases) {
          if (typeof a === "string" && a) synonyms.push(a)
        }
      }
      const parentIris: string[] = []
      if (typeof slotDef.is_a === "string" && slotDef.is_a) {
        parentIris.push(slotDef.is_a)
      }

      terms.push({
        curie,
        iri,
        label,
        type: "property",
        description,
        synonyms,
        parentIris,
        relatedPropertyIris: [],
      })
    }
  }

  return terms
}

/**
 * Extracts class and property definitions from an OWL Turtle string into standard RegistryTerms.
 */
export function extractTermsFromTurtle(turtleContent: string): RegistryTerm[] {
  try {
    const parsed = parseRdfTurtle(turtleContent)
    return parsed.terms.map((t) => ({
      curie: t.curie,
      iri: t.iri,
      label: t.label,
      type: t.type,
      description: t.description,
      synonyms: t.synonyms || [],
      parentIris: t.parentIris || [],
      relatedPropertyIris: [],
    }))
  } catch {
    return []
  }
}

/**
 * Fetches and parses terms from an ohi.dev package publication or artifact.
 */
export async function fetchRegistryTerms(
  source: string,
  sourceId: string,
  options?: { apiKey?: string; endpoint?: string }
): Promise<RegistryTerm[]> {
  try {
    const pub = await inspectOhiPublication(sourceId, {
      catalogUrl: options?.endpoint,
    })

    // 1. Prefer LinkML YAML artifact
    const linkmlDesc = pub.artifacts["linkml-yaml"]
    let linkmlContent = linkmlDesc?.content
    if (!linkmlContent) {
      const builtin = getBuiltinPublication(pub.package_ref)
      linkmlContent = builtin?.artifacts["linkml-yaml"]?.content
    }
    if (!linkmlContent && linkmlDesc?.url) {
      try {
        const res = await fetch(linkmlDesc.url, {
          signal: AbortSignal.timeout(1500),
        })
        if (res.ok) {
          linkmlContent = await res.text()
        }
      } catch {
        // network fallback
      }
    }

    if (linkmlContent) {
      const terms = extractTermsFromLinkmlYaml(
        linkmlContent,
        pub.base_url,
        pub.name
      )
      if (terms.length > 0) {
        return terms
      }
    }

    // 2. Fall back to OWL Turtle artifact
    const turtleDesc = pub.artifacts["owl-turtle"]
    let turtleContent = turtleDesc?.content
    if (!turtleContent) {
      const builtin = getBuiltinPublication(pub.package_ref)
      turtleContent = builtin?.artifacts["owl-turtle"]?.content
    }
    if (!turtleContent && turtleDesc?.url) {
      try {
        const res = await fetch(turtleDesc.url, {
          signal: AbortSignal.timeout(1500),
        })
        if (res.ok) {
          turtleContent = await res.text()
        }
      } catch {
        // network fallback
      }
    }

    if (turtleContent) {
      const terms = extractTermsFromTurtle(turtleContent)
      if (terms.length > 0) {
        return terms
      }
    }
  } catch {
    // If not found in OHI or network error occurs, return empty array
  }

  return []
}
