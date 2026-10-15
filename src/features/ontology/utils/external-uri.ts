export const KNOWN_ONTOLOGY_PREFIXES: Record<string, string> = {
  sosa: "http://www.w3.org/ns/sosa/",
  ssn: "http://www.w3.org/ns/ssn/",
  schema: "https://schema.org/",
  skos: "http://www.w3.org/2004/02/skos/core#",
  geo: "http://www.w3.org/2003/01/geo/wgs84_pos#",
  wgs84: "http://www.w3.org/2003/01/geo/wgs84_pos#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  owl: "http://www.w3.org/2002/07/owl#",
  qudt: "http://qudt.org/schema/qudt/",
  unit: "http://qudt.org/vocab/unit/",
  envo: "http://purl.obolibrary.org/obo/ENVO_",
  bfo: "http://purl.obolibrary.org/obo/BFO_",
  prov: "http://www.w3.org/ns/prov#",
  dcat: "http://www.w3.org/ns/dcat#",
  dcterms: "http://purl.org/dc/terms/",
  dc: "http://purl.org/dc/elements/1.1/",
  foaf: "http://xmlns.com/foaf/0.1/",
  time: "http://www.w3.org/2006/time#",
  obo: "http://purl.obolibrary.org/obo/",
}

/**
 * Resolves a CURIE (e.g. "sosa:Sample"), full IRI (e.g. "http://..."), or standard term identifier
 * into its full canonical external URI. Returns null if it cannot be resolved.
 */
export function resolveExternalUri(
  identifierOrCurie?: string | null,
  explicitIri?: string | null
): string | null {
  if (explicitIri?.trim()) {
    return explicitIri.trim()
  }

  if (!identifierOrCurie) return null
  const trimmed = identifierOrCurie.trim()

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("urn:")
  ) {
    return trimmed
  }

  const colonIndex = trimmed.indexOf(":")
  if (colonIndex > 0) {
    const prefix = trimmed.slice(0, colonIndex).toLowerCase()
    const localPart = trimmed.slice(colonIndex + 1)
    const base = KNOWN_ONTOLOGY_PREFIXES[prefix]
    if (base) {
      return `${base}${localPart}`
    }
  }

  return null
}
