import type { GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"
import { requestGeminiDraft } from "./gemini-provider"
import { requestOllamaDraft } from "./ollama-provider"
import { buildOntologyGenerationPrompt } from "./prompt-builder"
import type { AiGenerationOptions, PromptContext } from "./types"

export * from "./types"
export * from "./prompt-builder"
export * from "./gemini-provider"
export * from "./ollama-provider"

export async function executeAiGeneration(
  context: PromptContext,
  options: AiGenerationOptions
): Promise<GeneratedOntologyDraft> {
  const prompt = buildOntologyGenerationPrompt(context)

  if (options.provider === "gemini") {
    return requestGeminiDraft(prompt, {
      apiKey: options.apiKey,
      model: options.model,
    })
  }

  if (options.provider === "ollama") {
    return requestOllamaDraft(prompt, {
      baseUrl: options.baseUrl,
      model: options.model,
    })
  }

  throw new Error(`Unsupported AI provider: ${(options as { provider: string }).provider}`)
}
