import type { GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"

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
}

export type GeminiGenerationOptions = {
  provider: "gemini"
  apiKey?: string
  model?: string
}

export type OllamaGenerationOptions = {
  provider: "ollama"
  baseUrl?: string
  model?: string
}

export type AiGenerationOptions =
  | GeminiGenerationOptions
  | OllamaGenerationOptions
