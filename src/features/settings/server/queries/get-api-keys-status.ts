import { eq } from "drizzle-orm"

import { getDb } from "@/server/database"
import { userApiKeys } from "@/server/db/schema"
import { getUserIdFromCookies } from "@/server/user-identity"
import type { ProviderConfigStatus } from "../types"

export async function getUserApiKeysStatus(): Promise<ProviderConfigStatus[]> {
  const statuses: ProviderConfigStatus[] = []

  let userRecords: {
    provider: string
    key_hint: string
    updated_at: string | null
  }[] = []

  try {
    const userId = await getUserIdFromCookies()
    if (userId) {
      const db = getDb()
      userRecords = await db
        .select({
          provider: userApiKeys.provider,
          key_hint: userApiKeys.key_hint,
          updated_at: userApiKeys.updated_at,
        })
        .from(userApiKeys)
        .where(eq(userApiKeys.user_id, userId))
    }
  } catch (error) {
    // Database or cookie context might not be available
  }

  // Provider 1: Gemini
  const geminiRecord = userRecords.find((r) => r.provider === "gemini")
  const hasGeminiEnv = Boolean(process.env.GEMINI_API_KEY?.trim())

  statuses.push({
    provider: "gemini",
    displayName: "Google Gemini",
    isConfigured: Boolean(geminiRecord),
    keyHint: geminiRecord?.key_hint,
    updatedAt: geminiRecord?.updated_at ?? undefined,
    hasEnvFallback: hasGeminiEnv,
  })

  return statuses
}
