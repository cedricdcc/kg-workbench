"use server"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { analystConversations } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { DbOrTx } from "@/server/events/types"

export async function deleteConversationAction(
  conversationId: string,
  dbInstance?: DbOrTx
): Promise<{ success: boolean }> {
  if (!conversationId || !conversationId.trim()) {
    throw new Error("conversationId is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  await (
    db as unknown as {
      delete: (table: unknown) => {
        where: (condition: unknown) => Promise<unknown>
      }
    }
  )
    .delete(analystConversations)
    .where(
      and(
        eq(analystConversations.id, conversationId.trim()),
        eq(analystConversations.group_key, groupKey)
      )
    )

  return { success: true }
}
