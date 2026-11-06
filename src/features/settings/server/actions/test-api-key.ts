"use server"

import { getEffectiveApiKey, getEffectiveEndpoint } from "@/server/api-keys"
import type { SupportedProvider } from "../types"

export async function testUserApiKey(
  provider: SupportedProvider,
  candidateKey?: string
): Promise<{
  ok: boolean
  latencyMs?: number
  message?: string
  error?: string
}> {
  if (provider === "vllm") {
    let baseUrl: string | null = null
    let apiKey: string | null = null

    if (candidateKey) {
      const trimmed = candidateKey.trim()
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        baseUrl = trimmed
        apiKey = await getEffectiveApiKey("vllm")
      } else if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.baseUrl === "string" && parsed.baseUrl.trim()) {
              baseUrl = parsed.baseUrl.trim()
            }
            if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
              apiKey = parsed.apiKey.trim()
            }
          }
        } catch {
          // not valid JSON
        }
      } else {
        apiKey = trimmed
      }
    }

    if (!baseUrl) {
      baseUrl =
        (await getEffectiveEndpoint("vllm")) || "http://localhost:8000/v1"
    }
    if (!apiKey) {
      apiKey = await getEffectiveApiKey("vllm")
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, "")
    const targetUrl = `${cleanBaseUrl}/models`

    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (apiKey && apiKey.trim() && apiKey !== "undefined") {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`
      }

      const response = await fetch(targetUrl, {
        method: "GET",
        signal: controller.signal,
        headers,
      })

      clearTimeout(timeout)
      const latencyMs = Math.round(performance.now() - startTime)

      if (response.ok) {
        return {
          ok: true,
          latencyMs,
          message: "Connected successfully to vLLM server.",
        }
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error:
            "Unauthorized: Invalid API key or bearer token (HTTP 401/403).",
        }
      }

      return {
        ok: false,
        error: `vLLM server returned HTTP status ${response.status}: ${response.statusText}`,
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof Error && err.name === "AbortError") {
        return {
          ok: false,
          error: "Connection timed out after 6 seconds.",
        }
      }
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Failed to connect to vLLM server: ${err.message}`
            : "Failed to connect to vLLM server.",
      }
    }
  }

  const key = candidateKey?.trim() || (await getEffectiveApiKey(provider))
  if (!key) {
    return { ok: false, error: "No API key configured to test." }
  }

  if (provider === "gemini") {
    const startTime = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          key
        )}&pageSize=1`,
        {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      clearTimeout(timeout)
      const latencyMs = Math.round(performance.now() - startTime)

      if (response.ok) {
        return { ok: true, latencyMs }
      }

      if (response.status === 400 || response.status === 403) {
        return {
          ok: false,
          error: "Invalid API key or insufficient permissions (HTTP 400/403).",
        }
      }

      return {
        ok: false,
        error: `Gemini API returned HTTP status ${response.status}: ${response.statusText}`,
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof Error && err.name === "AbortError") {
        return {
          ok: false,
          error: "Connection timed out after 6 seconds.",
        }
      }
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to connect to Google Gemini API.",
      }
    }
  }

  return {
    ok: false,
    error: `Testing provider "${provider}" is not supported.`,
  }
}
