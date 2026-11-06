import {
  GeneratedOntologyDraftSchema,
  type GeneratedOntologyDraft,
} from "@/features/ontology/schemas/ai-generation"
import { getLlmClient } from "@/server/llm"

export async function requestOllamaDraft(
  prompt: { systemPrompt: string; userPrompt: string },
  options?: { baseUrl?: string; model?: string }
): Promise<GeneratedOntologyDraft> {
  const client = getLlmClient()
  const result = await client.generateStructured<GeneratedOntologyDraft>(
    {
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    },
    {
      provider: "vllm",
      baseUrl: options?.baseUrl,
      model: options?.model,
      schema: GeneratedOntologyDraftSchema,
      schemaName: "GeneratedOntologyDraft",
    }
  )
  return result.data
}
