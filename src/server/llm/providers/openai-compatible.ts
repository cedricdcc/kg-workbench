import type { ProviderCallArgs, ProviderRawResponse } from "../types"

interface ModelCacheEntry {
  timestamp: number
  models: string[]
}

const CACHE_TTL_MS = 300_000 // 5 minutes
const modelCache = new Map<string, ModelCacheEntry>()

export function _clearModelCache(): void {
  modelCache.clear()
}

export async function callOpenAiCompatibleApi(
  options: ProviderCallArgs
): Promise<ProviderRawResponse> {
  const baseUrl = (
    options.baseUrl?.trim() ||
    process.env.VLLM_BASE_URL?.trim() ||
    "http://localhost:8000/v1"
  ).replace(/\/+$/, "")

  const url = `${baseUrl}/chat/completions`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const apiKey = options.apiKey?.trim()
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const messages: Array<{ role: string; content: string }> = []
  if (options.prompt.systemPrompt) {
    messages.push({
      role: "system",
      content: options.prompt.systemPrompt,
    })
  }
  messages.push({
    role: "user",
    content: options.prompt.userPrompt,
  })

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    body.max_tokens = options.maxTokens
  }
  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" }
  }

  const timeoutMs = options.timeoutMs ?? 30000
  const startTime = performance.now()

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to reach OpenAI-compatible API at ${url}: ${message}`
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
      `OpenAI-compatible API error (${response.status}): ${errorMessage}`
    ) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const durationMs = Math.round(performance.now() - startTime)
  let data: {
    choices?: Array<{
      message?: {
        content?: string
      }
    }>
  }
  try {
    data = (await response.json()) as typeof data
  } catch {
    throw new Error(
      `Failed to parse OpenAI-compatible response as JSON from ${url}`
    )
  }

  const text = data.choices?.[0]?.message?.content ?? ""
  return {
    text,
    durationMs,
  }
}

export async function discoverOpenAiModels(
  baseUrl: string,
  apiKey?: string
): Promise<string[]> {
  const normalizedBaseUrl = (
    baseUrl?.trim() ||
    process.env.VLLM_BASE_URL?.trim() ||
    "http://localhost:8000/v1"
  ).replace(/\/+$/, "")

  const cached = modelCache.get(normalizedBaseUrl)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.models
  }

  const url = `${normalizedBaseUrl}/models`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  const key = apiKey?.trim()
  if (key) {
    headers["Authorization"] = `Bearer ${key}`
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to reach OpenAI-compatible models endpoint at ${url}: ${message}`
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
      `OpenAI-compatible API error (${response.status}): ${errorMessage}`
    ) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const data = (await response.json()) as {
    data?: Array<{
      id?: string
    }>
  }

  const models: string[] = Array.isArray(data.data)
    ? data.data
        .map((m) => m?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    : []

  modelCache.set(normalizedBaseUrl, {
    timestamp: Date.now(),
    models,
  })

  return models
}
