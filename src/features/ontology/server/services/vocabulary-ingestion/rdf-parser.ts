import { Parser as N3Parser, type Quad } from "n3"
import { XMLParser } from "fast-xml-parser"

export interface ParsedOntologyTerm {
  curie: string
  iri: string
  label: string
  type: "class" | "property" | "individual"
  propertyKind?: "datatype" | "object"
  description: string
  synonyms: string[]
  parentIris: string[]
  domainIris: string[]
  rangeIris: string[]
}

export interface ParsedOntologyFile {
  prefix: string
  name: string
  baseIri: string
  terms: ParsedOntologyTerm[]
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment"
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain"
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range"
const RDFS_SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf"
const SKOS_PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel"

const OWL_CLASS = "http://www.w3.org/2002/07/owl#Class"
const RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class"
const OWL_OBJECT_PROPERTY = "http://www.w3.org/2002/07/owl#ObjectProperty"
const OWL_DATATYPE_PROPERTY = "http://www.w3.org/2002/07/owl#DatatypeProperty"
const RDF_PROPERTY = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property"
const OWL_ONTOLOGY = "http://www.w3.org/2002/07/owl#Ontology"

function extractCurie(
  iri: string,
  prefixes: Record<string, string>,
  fallbackPrefix: string
): string {
  for (const [prefix, base] of Object.entries(prefixes)) {
    if (prefix && iri.startsWith(base)) {
      return `${prefix}:${iri.slice(base.length)}`
    }
  }
  const parts = iri.split(/[\/#]/)
  const suffix = parts[parts.length - 1] || "term"
  return `${fallbackPrefix}:${suffix}`
}

export function parseRdfTurtle(content: string): ParsedOntologyFile {
  const parser = new N3Parser()
  const quads: Quad[] = parser.parse(content)
  const prefixes =
    (parser as unknown as { _prefixes?: Record<string, string> })._prefixes ||
    {}

  let ontologyIri = ""
  let ontologyLabel = ""
  let detectedPrefix = "custom"

  // Check prefixes for custom or default
  for (const [p, uri] of Object.entries(prefixes)) {
    if (
      p &&
      p !== "owl" &&
      p !== "rdf" &&
      p !== "rdfs" &&
      p !== "xsd" &&
      p !== "skos"
    ) {
      detectedPrefix = p.toLowerCase()
      ontologyIri = uri
      break
    }
  }

  // Find owl:Ontology quad
  for (const q of quads) {
    if (q.predicate.value === RDF_TYPE && q.object.value === OWL_ONTOLOGY) {
      ontologyIri = q.subject.value
      const parts = ontologyIri.split(/[\/#]/).filter(Boolean)
      if (parts.length > 0) {
        detectedPrefix = parts[parts.length - 1].toLowerCase()
      }
    }
    if (q.subject.value === ontologyIri && q.predicate.value === RDFS_LABEL) {
      ontologyLabel = q.object.value
    }
  }

  if (!ontologyLabel) {
    const parts = (ontologyIri || "custom").split(/[\/#]/).filter(Boolean)
    ontologyLabel = parts[parts.length - 1] || "Custom Ontology"
  }

  // Group terms by subject IRI
  const termsMap = new Map<
    string,
    {
      iri: string
      type?: "class" | "property" | "individual"
      propertyKind?: "datatype" | "object"
      label?: string
      description?: string
      parentIris: string[]
      domainIris: string[]
      rangeIris: string[]
    }
  >()

  for (const q of quads) {
    const subjectIri = q.subject.value
    // Skip blank nodes and ontology node itself
    if (subjectIri.startsWith("_:") || subjectIri === ontologyIri) continue

    let entry = termsMap.get(subjectIri)
    if (!entry) {
      entry = {
        iri: subjectIri,
        parentIris: [],
        domainIris: [],
        rangeIris: [],
      }
      termsMap.set(subjectIri, entry)
    }

    if (q.predicate.value === RDF_TYPE) {
      const obj = q.object.value
      if (obj === OWL_CLASS || obj === RDFS_CLASS) {
        entry.type = "class"
      } else if (obj === OWL_OBJECT_PROPERTY) {
        entry.type = "property"
        entry.propertyKind = "object"
      } else if (obj === OWL_DATATYPE_PROPERTY) {
        entry.type = "property"
        entry.propertyKind = "datatype"
      } else if (obj === RDF_PROPERTY) {
        entry.type = "property"
      }
    } else if (
      q.predicate.value === RDFS_LABEL ||
      q.predicate.value === SKOS_PREF_LABEL
    ) {
      if (!entry.label) entry.label = q.object.value
    } else if (q.predicate.value === RDFS_COMMENT) {
      if (!entry.description) entry.description = q.object.value
    } else if (q.predicate.value === RDFS_SUBCLASS_OF) {
      if (!q.object.value.startsWith("_:")) {
        entry.parentIris.push(q.object.value)
      }
    } else if (q.predicate.value === RDFS_DOMAIN) {
      if (!q.object.value.startsWith("_:")) {
        entry.domainIris.push(q.object.value)
      }
    } else if (q.predicate.value === RDFS_RANGE) {
      if (!q.object.value.startsWith("_:")) {
        entry.rangeIris.push(q.object.value)
      }
    }
  }

  const terms: ParsedOntologyTerm[] = []
  for (const entry of termsMap.values()) {
    if (!entry.type) continue // only keep recognized classes/properties

    const curie = extractCurie(entry.iri, prefixes, detectedPrefix)
    const label = entry.label || curie.split(":")[1] || entry.iri

    terms.push({
      curie,
      iri: entry.iri,
      label,
      type: entry.type,
      propertyKind: entry.propertyKind,
      description: entry.description || "",
      synonyms: [],
      parentIris: entry.parentIris,
      domainIris: entry.domainIris,
      rangeIris: entry.rangeIris,
    })
  }

  return {
    prefix: detectedPrefix,
    name: ontologyLabel,
    baseIri: ontologyIri || `http://example.org/${detectedPrefix}#`,
    terms,
  }
}

export function parseRdfXml(content: string): ParsedOntologyFile {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  })
  const parsed = parser.parse(content)
  const rdf = parsed["rdf:RDF"] || parsed.RDF || parsed

  let prefix = "custom"
  let ontologyLabel = "Custom Ontology"
  let baseIri = "http://example.org/custom#"

  const ontologyNode = rdf["owl:Ontology"] || rdf.Ontology
  if (ontologyNode) {
    baseIri = ontologyNode["@_rdf:about"] || ontologyNode["@_about"] || baseIri
    const labelNode = ontologyNode["rdfs:label"] || ontologyNode.label
    if (typeof labelNode === "string") ontologyLabel = labelNode
    else if (labelNode && typeof labelNode["#text"] === "string")
      ontologyLabel = labelNode["#text"]
    const parts = baseIri.split(/[\/#]/).filter(Boolean)
    prefix = (parts[parts.length - 1] || "custom").toLowerCase()
  }

  const terms: ParsedOntologyTerm[] = []

  function processNodes(
    nodes: unknown,
    type: "class" | "property",
    propertyKind?: "datatype" | "object"
  ) {
    if (!nodes) return
    const list = Array.isArray(nodes) ? nodes : [nodes]
    for (const node of list) {
      if (!node || typeof node !== "object") continue
      const iri = node["@_rdf:about"] || node["@_about"] || ""
      if (!iri || iri.startsWith("_:")) continue

      let label = ""
      const rawLabel = node["rdfs:label"] || node.label
      if (typeof rawLabel === "string") label = rawLabel
      else if (rawLabel && typeof rawLabel["#text"] === "string")
        label = rawLabel["#text"]

      let description = ""
      const rawComment = node["rdfs:comment"] || node.comment
      if (typeof rawComment === "string") description = rawComment
      else if (rawComment && typeof rawComment["#text"] === "string")
        description = rawComment["#text"]

      const parts = iri.split(/[\/#]/)
      const last = parts[parts.length - 1] || "term"
      const curie = `${prefix}:${last}`
      if (!label) label = last

      const domainIris: string[] = []
      const domainNode = node["rdfs:domain"] || node.domain
      if (domainNode) {
        const domList = Array.isArray(domainNode) ? domainNode : [domainNode]
        for (const d of domList) {
          const dIri = d["@_rdf:resource"] || d["@_resource"]
          if (dIri) domainIris.push(dIri)
        }
      }

      const rangeIris: string[] = []
      const rangeNode = node["rdfs:range"] || node.range
      if (rangeNode) {
        const rngList = Array.isArray(rangeNode) ? rangeNode : [rangeNode]
        for (const r of rngList) {
          const rIri = r["@_rdf:resource"] || r["@_resource"]
          if (rIri) rangeIris.push(rIri)
        }
      }

      const parentIris: string[] = []
      const subClassNode = node["rdfs:subClassOf"] || node.subClassOf
      if (subClassNode) {
        const scList = Array.isArray(subClassNode)
          ? subClassNode
          : [subClassNode]
        for (const sc of scList) {
          const scIri = sc["@_rdf:resource"] || sc["@_resource"]
          if (scIri) parentIris.push(scIri)
        }
      }

      terms.push({
        curie,
        iri,
        label,
        type,
        propertyKind,
        description,
        synonyms: [],
        parentIris,
        domainIris,
        rangeIris,
      })
    }
  }

  processNodes(rdf["owl:Class"] || rdf.Class, "class")
  processNodes(
    rdf["owl:ObjectProperty"] || rdf.ObjectProperty,
    "property",
    "object"
  )
  processNodes(
    rdf["owl:DatatypeProperty"] || rdf.DatatypeProperty,
    "property",
    "datatype"
  )

  return {
    prefix,
    name: ontologyLabel,
    baseIri,
    terms,
  }
}
