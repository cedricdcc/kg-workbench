export type RegistrySearchResult = {
  source: "ols" | "lov"
  sourceId: string
  prefix: string
  name: string
  description: string
  baseIri: string
}

export type RegistryTerm = {
  curie: string
  iri: string
  label: string
  type: "class" | "property" | "individual"
  description: string
  synonyms: string[]
  parentIris: string[]
  relatedPropertyIris: string[]
}
