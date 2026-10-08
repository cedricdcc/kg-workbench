import {
  GeneratedOntologyDraftSchema,
  sanitizeAiJsonResponse,
  type GeneratedOntologyDraft,
} from "@/features/ontology/schemas/ai-generation"

export async function requestOllamaDraft(
  prompt: { systemPrompt: string; userPrompt: string },
  options?: { baseUrl?: string; model?: string }
): Promise<GeneratedOntologyDraft> {
  const baseUrl = (
    options?.baseUrl?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    "http://localhost:11434"
  ).replace(/\/$/, "")

  const model =
    options?.model?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    "qwen2.5"

  const url = `${baseUrl}/api/chat`

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: `${prompt.systemPrompt}\n\nStrict schema requirement:\nOutput a single JSON object with the exact keys: "modules", "classes", "relations", "cqMappings".`,
      },
      {
        role: "user",
        content: prompt.userPrompt,
      },
    ],
    format: "json",
    stream: false,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).catch((err) => {
    throw new Error(
      `Could not connect to Ollama at ${baseUrl}. Please ensure Ollama is running (e.g. 'ollama serve') and accessible. Error: ${err.message}`
    )
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `Ollama returned error (${response.status}): ${errorText || response.statusText}`
    )
  }

  const data = (await response.json()) as {
    message?: { content?: string }
  }

  const content = data.message?.content
  if (!content) {
    throw new Error("Ollama returned an empty response message.")
  }

  const sanitized = sanitizeAiJsonResponse(content)
  const parsedJson = JSON.parse(sanitized)
  return GeneratedOntologyDraftSchema.parse(parsedJson)
}
