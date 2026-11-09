"use server"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { analystConversations } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { DbOrTx } from "@/server/events/types"
import type { AnalystConversation } from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function getConversationsQuery(
  ontologyId: string,
  dbInstance?: DbOrTx
): Promise<AnalystConversation[]> {
  if (!ontologyId || !ontologyId.trim()) {
    return []
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  const records = await (
    db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            orderBy: (
              order: unknown
            ) => Promise<Array<typeof analystConversations.$inferSelect>>
          }
        }
      }
    }
  )
    .select()
    .from(analystConversations)
    .where(
      and(
        eq(analystConversations.ontology_id, ontologyId.trim()),
        eq(analystConversations.group_key, groupKey)
      )
    )
    .orderBy(desc(analystConversations.updated_at))

  return records.map((r) => ({
    id: r.id,
    ontologyId: r.ontology_id || "",
    groupKey: r.group_key,
    title: r.title,
    createdAt: formatTimestamp(r.created_at),
    updatedAt: formatTimestamp(r.updated_at),
  }))
}
