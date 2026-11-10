"use server"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { datasetSources, extractionRuns, facts } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { publishDomainEvent } from "@/server/events/outbox"
import type { DbOrTx } from "@/server/events/types"

export interface RunDriftAnalysisResult {
  success: boolean
  eventId?: string
  jobId?: string
}

export async function runDriftAnalysisAction(
  ontologyIdOrInput: string | { ontologyId: string },
  dbInstance?: DbOrTx
): Promise<RunDriftAnalysisResult> {
  const ontologyId =
    typeof ontologyIdOrInput === "string"
      ? ontologyIdOrInput
      : ontologyIdOrInput?.ontologyId

  if (!ontologyId || !ontologyId.trim()) {
    throw new Error("ontologyId is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  // 1. Fetch accepted facts for ontology
  let factsList: Array<Record<string, unknown>> = []
  try {
    const factRows = await (
      db as unknown as {
        select: (fields?: unknown) => {
          from: (table: unknown) => {
            innerJoin: (
              joinTable: unknown,
              onCond: unknown
            ) => {
              where: (
                condition: unknown
              ) => Promise<Array<Record<string, unknown>>>
            }
          }
        }
      }
    )
      .select({
        id: facts.id,
        subject_text: facts.subject_text,
        relation_text: facts.relation_text,
        object_text: facts.object_text,
        subject_entity_id: facts.subject_entity_id,
        object_entity_id: facts.object_entity_id,
        relation_type_id: facts.relation_type_id,
        review_status: facts.review_status,
        confidence: facts.confidence,
        document_id: facts.document_id,
        created_at: facts.created_at,
      })
      .from(facts)
      .innerJoin(extractionRuns, eq(facts.extraction_run_id, extractionRuns.id))
      .where(
        and(
          eq(extractionRuns.ontology_id, ontologyId.trim()),
          eq(facts.review_status, "accepted")
        )
      )

    if (Array.isArray(factRows)) {
      factsList = factRows
    }
  } catch {
    factsList = []
  }

  // 2. Fetch mapped dataset sources
  let datasetsList: Array<Record<string, unknown>> = []
  try {
    const datasetRows = await (
      db as unknown as {
        select: () => {
          from: (table: unknown) => {
            where: (
              condition: unknown
            ) => Promise<Array<typeof datasetSources.$inferSelect>>
          }
        }
      }
    )
      .select()
      .from(datasetSources)
      .where(
        and(
          eq(datasetSources.ontology_id, ontologyId.trim()),
          eq(datasetSources.group_key, groupKey)
        )
      )

    if (Array.isArray(datasetRows)) {
      datasetsList = datasetRows.map((ds) => ({
        id: ds.id,
        sourceName: ds.source_name,
        fileFormat: ds.file_format,
        rowCount: ds.row_count,
        columnCount: ds.column_count,
        profileSummary: ds.profile_summary,
        sampleRows: ds.sample_rows,
        mappingSpec: ds.mapping_spec,
      }))
    }
  } catch {
    datasetsList = []
  }

  const { eventId, jobId } = await publishDomainEvent(db, {
    eventType: "analyst.drift_analysis_requested",
    aggregateType: "ontology",
    aggregateId: ontologyId.trim(),
    payload: {
      ontologyId: ontologyId.trim(),
      groupKey,
      facts: factsList,
      datasets: datasetsList,
    },
  })

  return {
    success: true,
    eventId,
    jobId,
  }
}
