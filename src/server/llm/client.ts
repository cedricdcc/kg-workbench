import type { ZodType } from "zod"
import { getEffectiveApiKey, getEffectiveEndpoint } from "../api-keys"
import { getCandidateModels } from "./catalog"
import { callGeminiApi } from "./providers/gemini-provider"
import {
  callOpenAiCompatibleApi,
  discoverOpenAiModels,
} from "./providers/openai-compatible"
import type {
  LlmExecutionTrace,
  LlmGenerateOptions,
  LlmPrompt,
  LlmStructuredOptions,
  LlmStructuredResult,
  LlmTextResult,
  ProviderRawResponse,
  SupportedLlmProvider,
} from "./types"

/**
 * Sanitizes markdown code fences (e.g. ```json ... ``` or ``` ... ```)
 * from LLM raw response text, leaving trimmed valid JSON.
 */
export function sanitizeJsonText(rawText: string): string {
  let text = rawText.trim()
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\s*/, "")
    text = text.replace(/\s*```\s*$/, "")
  }
  return text.trim()
}

interface ResolvedConfig {
  provider: SupportedLlmProvider
  apiKey: string
  baseUrl: string
  candidates: string[]
}

type ResponseHandler<T> = (
  response: ProviderRawResponse,
  candidate: string
) => { success: true; value: T } | { success: false; error: string }

export class LlmClient {
  private async resolveConfig(
    options?: LlmGenerateOptions
  ): Promise<ResolvedConfig> {
    const provider: SupportedLlmProvider = options?.provider ?? "gemini"

    if (provider === "gemini") {
      const apiKey =
        options?.apiKey ||
        (await getEffectiveApiKey("gemini").catch(() => null)) ||
        process.env.GEMINI_API_KEY ||
        ""

      const candidates = getCandidateModels(
        "gemini",
        options?.model,
        options?.candidateModels
      )

      return {
        provider,
        apiKey,
        baseUrl: "",
        candidates,
      }
    }

    // provider === "vllm" || provider === "openai"
    const resolvedEndpoint = await getEffectiveEndpoint(provider).catch(
      () => null
    )
    const baseUrl = (
      options?.baseUrl ||
      resolvedEndpoint ||
      process.env.VLLM_BASE_URL ||
      "http://localhost:8000/v1"
    ).replace(/\/+$/, "")

    const apiKey =
      options?.apiKey ||
      (await getEffectiveApiKey(provider).catch(() => null)) ||
      process.env.VLLM_API_KEY ||
      ""

    let candidates: string[]
    if (options?.candidateModels && options.candidateModels.length > 0) {
      candidates = options.model
        ? getCandidateModels(provider, options.model, options.candidateModels)
        : options.candidateModels
    } else if (options?.model) {
      candidates = [options.model]
    } else {
      const discovered = await discoverOpenAiModels(baseUrl, apiKey).catch(
        (err: unknown) => {
          const status = (err as { status?: number })?.status
          if (status === 401 || status === 403) {
            throw err
          }
          return []
        }
      )
      candidates = discovered.length > 0 ? [discovered[0]] : ["default"]
    }

    return {
      provider,
      apiKey,
      baseUrl,
      candidates,
    }
  }

  private async executeWithFallback<T>(
    prompt: LlmPrompt,
    options: LlmGenerateOptions | undefined,
    responseFormat: "json" | "text" | undefined,
    jsonSchema: Record<string, unknown> | undefined,
    handleResponse: ResponseHandler<T>
  ): Promise<{ value: T; trace: LlmExecutionTrace }> {
    const { provider, apiKey, baseUrl, candidates } =
      await this.resolveConfig(options)

    const trace: LlmExecutionTrace = {
      provider,
      model: candidates[0] ?? "",
      attempts: [],
      totalDurationMs: 0,
    }

    const overallStart = performance.now()

    for (const candidate of candidates) {
      const attemptStart = performance.now()
      let response: ProviderRawResponse

      try {
        if (provider === "gemini") {
          response = await callGeminiApi({
            model: candidate,
            prompt,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            timeoutMs: options?.timeoutMs,
            apiKey,
            responseFormat,
            jsonSchema,
          })
        } else {
          response = await callOpenAiCompatibleApi({
            model: candidate,
            prompt,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            timeoutMs: options?.timeoutMs,
            apiKey,
            baseUrl,
            responseFormat,
          })
        }
      } catch (err: unknown) {
        const attemptDuration = Math.round(performance.now() - attemptStart)
        const status = (err as { status?: number })?.status

        if (status === 401 || status === 403) {
          trace.attempts.push({
            model: candidate,
            status,
            error: err instanceof Error ? err.message : String(err),
            durationMs: attemptDuration,
          })
          trace.totalDurationMs = Math.round(performance.now() - overallStart)
          throw err
        }

        trace.attempts.push({
          model: candidate,
          status: status ?? "error",
          error: err instanceof Error ? err.message : String(err),
          durationMs: attemptDuration,
        })
        continue
      }

      const attemptDuration = Math.round(performance.now() - attemptStart)
      const outcome = handleResponse(response, candidate)

      if (!outcome.success) {
        trace.attempts.push({
          model: candidate,
          status: "schema_error",
          error: outcome.error,
          durationMs: attemptDuration,
        })
        continue
      }

      trace.attempts.push({
        model: candidate,
        status: 200,
        durationMs: attemptDuration,
      })
      trace.model = candidate
      trace.totalDurationMs = Math.round(performance.now() - overallStart)

      return {
        value: outcome.value,
        trace,
      }
    }

    trace.totalDurationMs = Math.round(performance.now() - overallStart)
    throw new Error(
      `All candidate models failed for provider ${provider}. Attempts: ${JSON.stringify(trace.attempts)}`
    )
  }

  async generateText(
    prompt: LlmPrompt,
    options?: LlmGenerateOptions
  ): Promise<LlmTextResult> {
    const { value, trace } = await this.executeWithFallback<{ text: string }>(
      prompt,
      options,
      undefined,
      undefined,
      (response) => ({
        success: true,
        value: { text: response.text },
      })
    )

    return {
      text: value.text,
      trace,
    }
  }

  async generateStructured<T>(
    prompt: LlmPrompt,
    options: LlmStructuredOptions<T>
  ): Promise<LlmStructuredResult<T>> {
    const isZod =
      typeof (options.schema as { safeParse?: unknown })?.safeParse ===
      "function"
    const jsonSchema =
      options.jsonSchema ??
      (!isZod ? (options.schema as Record<string, unknown>) : undefined)

    const { value, trace } = await this.executeWithFallback<{
      data: T
      rawText: string
    }>(prompt, options, "json", jsonSchema, (response) => {
      let jsonObj: unknown
      try {
        const cleanedText = sanitizeJsonText(response.text)
        jsonObj = JSON.parse(cleanedText)
      } catch (parseError: unknown) {
        const message =
          parseError instanceof Error ? parseError.message : String(parseError)
        return {
          success: false,
          error: `Invalid JSON: ${message}`,
        }
      }

      if (isZod) {
        const parsed = (options.schema as ZodType<T>).safeParse(jsonObj)
        if (!parsed.success) {
          return {
            success: false,
            error: parsed.error.message,
          }
        }
        return {
          success: true,
          value: {
            data: parsed.data,
            rawText: response.text,
          },
        }
      }

      return {
        success: true,
        value: {
          data: jsonObj as T,
          rawText: response.text,
        },
      }
    })

    return {
      data: value.data,
      rawText: value.rawText,
      trace,
    }
  }
}

let defaultClient: LlmClient | null = null

export function getLlmClient(): LlmClient {
  if (!defaultClient) {
    defaultClient = new LlmClient()
  }
  return defaultClient
}
