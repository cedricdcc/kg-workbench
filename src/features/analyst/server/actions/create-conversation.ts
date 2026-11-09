"use server"

import { getDb } from "@/server/database"
import { analystConversations } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { DbOrTx } from "@/server/events/types"
import type { AnalystConversation, CreateConversationInput } from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function createConversationAction(
  input: CreateConversationInput,
  dbInstance?: DbOrTx
): Promise<AnalystConversation> {
  if (!input.ontologyId || !input.ontologyId.trim()) {
    throw new Error("ontologyId is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()
  const title = input.title?.trim() || "New Analysis"

  const [inserted] = await (
    db as unknown as {
      insert: (table: unknown) => {
        values: (val: unknown) => {
          returning: () => Promise<
            Array<typeof analystConversations.$inferSelect>
          >
        }
      }
    }
  )
    .insert(analystConversations)
    .values({
      ontology_id: input.ontologyId.trim(),
      group_key: groupKey,
      title,
    })
    .returning()

  if (!inserted) {
    throw new Error("Failed to create analyst conversation.")
  }

  return {
    id: inserted.id,
    ontologyId: inserted.ontology_id || input.ontologyId.trim(),
    groupKey: inserted.group_key,
    title: inserted.title,
    createdAt: formatTimestamp(inserted.created_at),
    updatedAt: formatTimestamp(inserted.updated_at),
  }
}
