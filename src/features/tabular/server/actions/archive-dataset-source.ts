"use server"

import { getDb } from "@/server/database"
import { datasetSources } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { encryptSecret } from "@/server/crypto"
import type { DbOrTx } from "@/server/events/types"
import type { DatasetMappingSpec } from "@/features/tabular/types"

export interface ArchiveDatasetSourceInput {
  ontologyId: string
  sourceName: string
  fileFormat: string
  rowCount: number
  columnCount: number
  profileSummary: Record<string, unknown>
  sampleRows: Record<string, unknown>[]
  mappingSpec?: DatasetMappingSpec | null
  connectionConfig?: Record<string, unknown> | null
}

export async function archiveDatasetSourceAction(
  input: ArchiveDatasetSourceInput,
  dbInstance?: DbOrTx
): Promise<{ id: string }> {
  if (!input.ontologyId || !input.ontologyId.trim()) {
    throw new Error("ontologyId is required.")
  }
  if (!input.sourceName || !input.sourceName.trim()) {
    throw new Error("sourceName is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  let sanitizedConnectionConfig = input.connectionConfig ?? null
  if (sanitizedConnectionConfig && typeof sanitizedConnectionConfig === "object") {
    const config = { ...sanitizedConnectionConfig }
    if ("password" in config && typeof config.password === "string") {
      if (config.password.trim()) {
        config.encryptedPassword = encryptSecret(config.password)
      }
      delete config.password
    }
    sanitizedConnectionConfig = config
  }

  const [inserted] = await db
    .insert(datasetSources)
    .values({
      ontology_id: input.ontologyId,
      group_key: groupKey,
      source_name: input.sourceName.trim(),
      file_format: input.fileFormat || "csv",
      row_count: input.rowCount || 0,
      column_count: input.columnCount || 0,
      profile_summary: input.profileSummary,
      sample_rows: input.sampleRows || [],
      mapping_spec: input.mappingSpec || null,
      connection_config: sanitizedConnectionConfig,
      last_synced_at: sanitizedConnectionConfig ? new Date() : null,
    })
    .returning()

  if (!inserted) {
    throw new Error("Failed to archive dataset source.")
  }

  return { id: inserted.id }
}
