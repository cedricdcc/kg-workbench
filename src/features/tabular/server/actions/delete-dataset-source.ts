"use server"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { datasetSources } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"

export async function deleteDatasetSourceAction(
  id: string
): Promise<{ success: boolean }> {
  if (!id || !id.trim()) {
    throw new Error("id is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = getDb()

  const [deleted] = await db
    .delete(datasetSources)
    .where(
      and(eq(datasetSources.id, id), eq(datasetSources.group_key, groupKey))
    )
    .returning()

  return { success: Boolean(deleted) }
}
