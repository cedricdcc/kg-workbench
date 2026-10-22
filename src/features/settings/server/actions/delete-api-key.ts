"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import { userApiKeys } from "@/server/db/schema"
import { getUserIdFromCookies } from "@/server/user-identity"
import type { SupportedProvider } from "../types"

export async function deleteUserApiKey(
  provider: SupportedProvider
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await getUserIdFromCookies()
    if (!userId) {
      return { ok: true }
    }

    const db = getDb()
    await db
      .delete(userApiKeys)
      .where(
        and(
          eq(userApiKeys.user_id, userId),
          eq(userApiKeys.provider, provider)
        )
      )

    try {
      revalidatePath(routes.settings.root)
    } catch {
      // In case path is called outside of request
    }

    return { ok: true }
  } catch (error) {
    console.error("Failed to delete user API key:", error)
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to delete API key.",
    }
  }
}
