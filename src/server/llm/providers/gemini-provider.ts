import type { ProviderCallArgs, ProviderRawResponse } from "../types"

export async function callGeminiApi(
  options: ProviderCallArgs
): Promise<ProviderRawResponse> {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure a key in Settings or set GEMINI_API_KEY in your environment."
    )
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${apiKey}`

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: options.prompt.userPrompt }],
      },
    ],
  }

  if (options.prompt.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: options.prompt.systemPrompt }],
    }
  }

  const generationConfig: Record<string, unknown> = {}
  if (options.temperature !== undefined) {
    generationConfig.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = options.maxTokens
  }
  if (options.responseFormat === "json") {
    generationConfig.responseMimeType = "application/json"
    if (options.jsonSchema) {
      generationConfig.responseSchema = options.jsonSchema
    }
  }

  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig
  }

  const timeoutMs = options.timeoutMs ?? 30000
  const startTime = performance.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to reach Gemini API at ${url}: ${message}`)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    let errorMessage = errorText || response.statusText
    try {
      const parsed = JSON.parse(errorText)
      if (parsed.error?.message) {
        errorMessage = parsed.error.message
      }
    } catch {
      // Keep errorText
    }

    const error = new Error(
      `Gemini API error (${response.status}): ${errorMessage}`
    ) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const durationMs = Math.round(performance.now() - startTime)
  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  return {
    text,
    durationMs,
  }
}
