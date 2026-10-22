export type RegistrySearchResult = {
  source:
    | "ols"
    | "lov"
    | "bartoc"
    | "agroportal"
    | "bioportal"
    | "ecoportal"
    | "eu_vocabularies"
    | "custom"
    | string
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

export interface EndpointTestResult {
  ok: boolean
  statusCode: number
  latencyMs: number
  endpointUrl: string
  payloadPreview: unknown
  detectedVocabularies: RegistrySearchResult[]
  error?: string
}

export interface RegistrySearchOptions {
  endpoint?: string
  apiKey?: string
  limit?: number
  timeoutMs?: number
}

export interface RegistryFetchOptions {
  endpoint?: string
  apiKey?: string
  timeoutMs?: number
}

export interface VocabularyRegistryProvider {
  readonly id: string
  readonly name: string
  readonly defaultEndpoint: string
  readonly requiresApiKey: boolean
  readonly category: "general" | "biomedical" | "agri_eco" | "eu_public" | "iot" | "custom"

  testEndpoint(
    endpoint: string,
    apiKey?: string,
    query?: string
  ): Promise<EndpointTestResult>
  search(
    query: string,
    options?: RegistrySearchOptions
  ): Promise<RegistrySearchResult[]>
  fetchTerms(
    ontologyId: string,
    options?: RegistryFetchOptions
  ): Promise<RegistryTerm[]>
}
