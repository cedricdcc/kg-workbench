export type CompetencyQuestionInput = {
  id: string
  question: string
}

export type PromptContext = {
  ontologyName: string
  usecase: string
  existingModules: string[]
  existingClasses: string[]
  existingRelations: string[]
  competencyQuestions: CompetencyQuestionInput[]
  candidateReferenceTerms?: Array<{
    curie: string
    label: string
    description: string
    iri: string
    type: string
  }>
}

export type BaseGenerationOptions = {
  vocabulariesToImport?: Array<{
    prefix: string
    name: string
    baseIri: string
    sourceRegistry: string
    sourceId: string
  }>
}

export type GeminiGenerationOptions = BaseGenerationOptions & {
  provider: "gemini"
  apiKey?: string
  model?: string
}

export type OllamaGenerationOptions = BaseGenerationOptions & {
  provider: "ollama"
  baseUrl?: string
  model?: string
}

export type AiGenerationOptions =
  GeminiGenerationOptions | OllamaGenerationOptions
