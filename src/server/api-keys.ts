import { and, eq } from "drizzle-orm"

import { decryptSecret } from "@/server/crypto"
import { getDb } from "@/server/database"
import { userApiKeys } from "@/server/db/schema"
import { getUserIdFromCookies } from "@/server/user-identity"

export type SupportedApiKeyProvider = "gemini"

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
 * Resolve the effective API key for a provider.
 * Priority:
 * 1. Stored user API key (decrypted from database)
 * 2. Environment variable fallback (e.g. process.env.GEMINI_API_KEY)
 * 3. null if not configured
 */
export async function getEffectiveApiKey(
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
            `Failed to decrypt user API key for provider ${provider}:`,
            decryptError
          )
        }
      }
    }
  } catch (error) {
    // Database or cookie store might not be available or initialized
  }

  // Fallback to server environment variables
  if (provider === "gemini") {
    const envKey = process.env.GEMINI_API_KEY?.trim()
    return envKey || null
  }

  return null
}
