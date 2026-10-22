"use server"

import { getEffectiveApiKey } from "@/server/api-keys"
import type { SupportedProvider } from "../types"

export async function testUserApiKey(
  provider: SupportedProvider,
  candidateKey?: string
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
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

  return { ok: false, error: `Testing provider "${provider}" is not supported.` }
}
