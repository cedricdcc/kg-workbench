export interface ParseTurtleOptions {
  fileName?: string
  defaultLanguage?: string
  preferLinkml?: boolean
  engine?: "linkml" | "n3" | "auto"
}

export interface ExtractedOntologyHeader {
  name: string
  usecase: string
  version: string | null
  primaryNamespaceUri: string
  primaryPrefix: string
}

export interface RawRdfProperty {
  iri: string
  kind: "datatype" | "object"
  label: string
  description: string
  domainIris: string[]
  rangeIris: string[]
}
