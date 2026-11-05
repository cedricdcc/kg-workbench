import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { domainEvents, jobQueue } from "@/server/db/schema"
import type { ReasonerResultPayload } from "@/features/ontology/types"

export interface LatestReasonerRunResult {
  jobId: string
  status: string
  createdAt: string
  result: ReasonerResultPayload | null
}

export async function getLatestReasonerRunQuery(
  ontologyId: string
): Promise<LatestReasonerRunResult | null> {
  if (!ontologyId || !ontologyId.trim()) {
    return null
  }

  const db = getDb()

  const [row] = await db
    .select({
      jobId: jobQueue.id,
      status: jobQueue.status,
      createdAt: jobQueue.created_at,
      result: jobQueue.result,
    })
    .from(jobQueue)
    .innerJoin(domainEvents, eq(jobQueue.event_id, domainEvents.id))
    .where(
      and(
        eq(domainEvents.aggregate_id, ontologyId),
        eq(jobQueue.target_worker, "reasoner")
      )
    )
    .orderBy(desc(jobQueue.created_at))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    jobId: row.jobId,
    status: row.status,
    createdAt: row.createdAt || new Date().toISOString(),
    result: row.result as ReasonerResultPayload | null,
  }
}
