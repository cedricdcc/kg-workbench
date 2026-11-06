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

  const timeoutMs = options.timeoutMs ?? 60000
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
    throw new Error(
      `Failed to reach Gemini API for model ${options.model}: ${message}`
    )
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
  let data: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }
  try {
    data = (await response.json()) as typeof data
  } catch {
    throw new Error(
      `Failed to parse Gemini API response as JSON for model ${options.model}`
    )
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  return {
    text,
    durationMs,
  }
}

interface GeminiModelCacheEntry {
  timestamp: number
  models: string[]
}

const GEMINI_CACHE_TTL_MS = 300_000 // 5 minutes
const geminiModelCache = new Map<string, GeminiModelCacheEntry>()

export function _clearGeminiModelCache(): void {
  geminiModelCache.clear()
}

/**
 * Discovers available models directly from the Gemini provider API
 * that support 'generateContent', filtered to Gemini models and sorted with
 * flash models first. Caches results in memory for 5 minutes.
 */
export async function discoverGeminiModels(
  apiKey: string,
  timeoutMs: number = 10000
): Promise<string[]> {
  const cleanKey = apiKey.trim()
  if (!cleanKey) {
    return []
  }

  const cacheKey = cleanKey.length > 8 ? cleanKey.slice(-8) : cleanKey
  const cached = geminiModelCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < GEMINI_CACHE_TTL_MS) {
    return cached.models
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to reach Gemini API for models listing: ${message}`)
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

  let data: {
    models?: Array<{
      name?: string
      supportedGenerationMethods?: string[]
    }>
  }
  try {
    data = (await response.json()) as typeof data
  } catch {
    throw new Error("Failed to parse Gemini models listing as JSON")
  }

  if (!data.models || !Array.isArray(data.models)) {
    return []
  }

  const models = data.models
    .filter(
      (m) =>
        m.name &&
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name.includes("gemini")
    )
    .map((m) => (m.name as string).replace(/^models\//, "").trim())
    .sort((a, b) => {
      // Prioritize flash models
      const aFlash = a.includes("flash") ? -1 : 1
      const bFlash = b.includes("flash") ? -1 : 1
      if (aFlash !== bFlash) return aFlash - bFlash
      return a.localeCompare(b)
    })

  geminiModelCache.set(cacheKey, {
    timestamp: Date.now(),
    models,
  })

  return models
}
