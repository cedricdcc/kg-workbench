"use server"

import { getDb } from "@/server/database"
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

  const { eventId, jobId } = await publishDomainEvent(db, {
    eventType: "analyst.drift_analysis_requested",
    aggregateType: "ontology",
    aggregateId: ontologyId.trim(),
    payload: {
      ontologyId: ontologyId.trim(),
      groupKey,
    },
  })

  return {
    success: true,
    eventId,
    jobId,
  }
}
