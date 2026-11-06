import { and, eq } from "drizzle-orm"

import { decryptSecret } from "@/server/crypto"
import { getDb } from "@/server/database"
import { userApiKeys } from "@/server/db/schema"
import { getUserIdFromCookies } from "@/server/user-identity"

export type SupportedApiKeyProvider =
  "gemini" | "vllm" | "bioportal" | "agroportal" | "ecoportal" | string

/**
 * Format a masked hint showing the last 4 characters of an API key.
 */
export function formatKeyHint(key: string): string {
  if (!key || typeof key !== "string") {
    return ""
  }
  const trimmed = key.trim()
  if (trimmed.length <= 4) {
    return trimmed
  }
  return "..." + trimmed.slice(-4)
}

/**
 * Helper to fetch and decrypt a user-stored secret for a given provider.
 */
async function getUserDecryptedSecret(
  provider: SupportedApiKeyProvider
): Promise<string | null> {
  try {
    const userId = await getUserIdFromCookies()
    if (userId) {
      const db = getDb()
      const records = await db
        .select({
          encrypted_key: userApiKeys.encrypted_key,
          iv: userApiKeys.iv,
          tag: userApiKeys.tag,
        })
        .from(userApiKeys)
        .where(
          and(
            eq(userApiKeys.user_id, userId),
            eq(userApiKeys.provider, provider)
          )
        )
        .limit(1)

      if (records.length > 0) {
        const row = records[0]
        try {
          return decryptSecret(row.encrypted_key, row.iv, row.tag)
        } catch (decryptError) {
          console.error(
            `Failed to decrypt user secret for provider ${provider}:`,
            decryptError
          )
        }
      }
    }
  } catch {
    // Database or cookie store might not be available or initialized
  }
  return null
}

/**
 * Resolve the effective endpoint URL for a provider.
 * Priority:
 * 1. User stored configuration in database (starts with http(s):// or JSON { baseUrl })
 * 2. Environment variable fallback (process.env.VLLM_BASE_URL)
 * 3. Default "http://localhost:8000/v1"
 * Returns null for non-endpoint providers.
 */
export async function getEffectiveEndpoint(
  provider: SupportedApiKeyProvider
): Promise<string | null> {
  if (provider === "vllm") {
    const stored = await getUserDecryptedSecret("vllm")
    if (stored) {
      const trimmed = stored.trim()
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed
      }
      try {
        const parsed = JSON.parse(trimmed)
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.baseUrl === "string" &&
          parsed.baseUrl.trim()
        ) {
          return parsed.baseUrl.trim()
        }
      } catch {
        // Not JSON
      }
    }

    return process.env.VLLM_BASE_URL?.trim() || "http://localhost:8000/v1"
  }

  return null
}

/**
 * Resolve the effective API key for a provider.
 * Priority:
 * 1. Stored user API key (decrypted from database)
 * 2. Environment variable fallback (e.g. process.env.GEMINI_API_KEY, process.env.VLLM_API_KEY)
 * 3. null if not configured
 */
export async function getEffectiveApiKey(
  provider: SupportedApiKeyProvider
): Promise<string | null> {
  const stored = await getUserDecryptedSecret(provider)
  if (stored) {
    if (provider === "vllm") {
      const trimmed = stored.trim()
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        // Stored value is only an endpoint URL
        const envKey = process.env.VLLM_API_KEY?.trim()
        return envKey && envKey !== "undefined" ? envKey : null
      }
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
            return parsed.apiKey.trim()
          }
          const envKey = process.env.VLLM_API_KEY?.trim()
          return envKey && envKey !== "undefined" ? envKey : null
        }
      } catch {
        // Not JSON, treat as raw token
      }
      return trimmed || null
    }

    return stored
  }

  // Fallback to server environment variables
  if (provider === "vllm") {
    const envKey = process.env.VLLM_API_KEY?.trim()
    return envKey && envKey !== "undefined" ? envKey : null
  }
  if (provider === "gemini") {
    const envKey = process.env.GEMINI_API_KEY?.trim()
    return envKey || null
  }
  if (provider === "bioportal") {
    const envKey = process.env.BIOPORTAL_API_KEY?.trim()
    return envKey || null
  }
  if (provider === "agroportal") {
    const envKey = process.env.AGROPORTAL_API_KEY?.trim()
    return envKey || null
  }

  return null
}
