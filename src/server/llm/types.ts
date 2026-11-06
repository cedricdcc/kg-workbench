import type { ZodType } from "zod"

export type SupportedLlmProvider = "gemini" | "vllm" | "openai"

export interface LlmModelMetadata {
  id: string
  name: string
  provider: SupportedLlmProvider
  contextWindow?: number
  supportsStructured: boolean
  isDefault?: boolean
}

export interface LlmPrompt {
  systemPrompt?: string
  userPrompt: string
}

export interface LlmGenerateOptions {
  provider?: SupportedLlmProvider
  model?: string
  candidateModels?: string[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  apiKey?: string
  baseUrl?: string // For vLLM / OpenAI-compatible endpoints
}

export interface LlmStructuredOptions<T> extends LlmGenerateOptions {
  schema: ZodType<T> | Record<string, unknown>
  schemaName?: string
  schemaDescription?: string
}

export interface LlmExecutionAttempt {
  model: string
  status: number | "schema_error" | "error"
  error?: string
  durationMs: number
}

export interface LlmExecutionTrace {
  provider: SupportedLlmProvider
  model: string
  attempts: Array<LlmExecutionAttempt>
  totalDurationMs: number
}

export interface LlmTextResult {
  text: string
  trace: LlmExecutionTrace
}

export interface LlmStructuredResult<T> {
  data: T
  rawText: string
  trace: LlmExecutionTrace
}

export interface ProviderCallArgs {
  model: string
  prompt: LlmPrompt
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  apiKey?: string
  baseUrl?: string
  responseFormat?: "json" | "text"
  jsonSchema?: Record<string, unknown>
}

export interface ProviderRawResponse {
  text: string
  durationMs: number
}
