"use server"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { datasetSources } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { ArchivedDatasetSource } from "@/features/tabular/types"

export async function getDatasetSourcesQuery(
  ontologyId: string
): Promise<ArchivedDatasetSource[]> {
  if (!ontologyId || !ontologyId.trim()) {
    return []
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = getDb()

  const records = await db
    .select()
    .from(datasetSources)
    .where(
      and(
        eq(datasetSources.ontology_id, ontologyId),
        eq(datasetSources.group_key, groupKey)
      )
    )
    .orderBy(desc(datasetSources.created_at))

  return records.map((r) => ({
    id: r.id,
    ontologyId: r.ontology_id,
    groupKey: r.group_key,
    sourceName: r.source_name,
    fileFormat: r.file_format as "csv" | "parquet" | "excel",
    rowCount: r.row_count,
    columnCount: r.column_count,
    profileSummary:
      r.profile_summary as ArchivedDatasetSource["profileSummary"],
    sampleRows: r.sample_rows as Record<string, unknown>[],
    mappingSpec: r.mapping_spec as ArchivedDatasetSource["mappingSpec"],
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  }))
}
