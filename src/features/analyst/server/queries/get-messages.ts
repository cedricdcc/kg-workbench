"use server"

import { asc, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { analystMessages } from "@/server/db/schema"
import type { DbOrTx } from "@/server/events/types"
import type { AnalystMessage } from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function getMessagesQuery(
  conversationId: string,
  dbInstance?: DbOrTx
): Promise<AnalystMessage[]> {
  if (!conversationId || !conversationId.trim()) {
    return []
  }

  const db = dbInstance ?? getDb()

  const records = await (
    db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            orderBy: (
              order: unknown
            ) => Promise<Array<typeof analystMessages.$inferSelect>>
          }
        }
      }
    }
  )
    .select()
    .from(analystMessages)
    .where(eq(analystMessages.conversation_id, conversationId.trim()))
    .orderBy(asc(analystMessages.created_at))

  return records.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    sender: r.sender as "user" | "assistant",
    content: r.content,
    reasoningTrace: r.reasoning_trace || undefined,
    subgraph: r.subgraph || undefined,
    citations: r.citations || undefined,
    createdAt: formatTimestamp(r.created_at),
  }))
}
