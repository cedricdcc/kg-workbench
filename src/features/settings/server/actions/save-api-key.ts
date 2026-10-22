"use server"

import { revalidatePath } from "next/cache"

import { routes } from "@/lib/routes"
import { formatKeyHint } from "@/server/api-keys"
import { encryptSecret } from "@/server/crypto"
import { getDb } from "@/server/database"
import { userApiKeys } from "@/server/db/schema"
import { getOrCreateUserId } from "@/server/user-identity"
import { type SupportedProvider, validateApiKeyInput } from "../types"

export async function saveUserApiKey(
  provider: SupportedProvider,
  apiKey: string
): Promise<{ ok: boolean; keyHint?: string; error?: string }> {
  const validation = validateApiKeyInput(apiKey)
  if (!validation.valid) {
    return { ok: false, error: validation.error }
  }

  try {
    const userId = await getOrCreateUserId()
    const cleanKey = apiKey.trim()
    const keyHint = formatKeyHint(cleanKey)
    const { ciphertext, iv, tag } = encryptSecret(cleanKey)

    const db = getDb()
    await db
      .insert(userApiKeys)
      .values({
        user_id: userId,
        provider,
        encrypted_key: ciphertext,
        iv,
        tag,
        key_hint: keyHint,
      })
      .onConflictDoUpdate({
        target: [userApiKeys.user_id, userApiKeys.provider],
        set: {
          encrypted_key: ciphertext,
          iv,
          tag,
          key_hint: keyHint,
          updated_at: new Date().toISOString(),
        },
      })

    try {
      revalidatePath(routes.settings.root)
    } catch {
      // In case path is called outside of request
    }

    return { ok: true, keyHint }
  } catch (error) {
    console.error("Failed to save user API key:", error)
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to save API key.",
    }
  }
}
