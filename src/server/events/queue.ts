import { eq, sql } from "drizzle-orm"
import {
  analystConversations,
  analystMessages,
  domainEvents,
  jobQueue,
  knowledgeContradictions,
} from "../db/schema"
import type { DbOrTx } from "./types"

export function calculateRetryBackoff(attempt: number): number {
  return Math.pow(2, Math.max(1, attempt)) * 5
}

export function shouldMoveToDeadLetter(
  attempts: number,
  maxAttempts: number
): boolean {
  return attempts >= maxAttempts
}

export function buildClaimJobSql(
  workerType: string,
  workerId: string,
  leaseSeconds: number
): string {
  const safeWorkerType = workerType.replace(/[^a-zA-Z0-9_-]/g, "")
  const safeWorkerId = workerId.replace(/[^a-zA-Z0-9_-]/g, "")
  const safeLeaseSeconds = Math.max(1, Math.min(3600, leaseSeconds))

  return `
UPDATE job_queue
SET 
  status = 'claimed',
  locked_by = '${safeWorkerId}',
  locked_until = NOW() + INTERVAL '${safeLeaseSeconds} seconds',
  attempts = attempts + 1,
  updated_at = NOW()
WHERE id = (
  SELECT id FROM job_queue
  WHERE target_worker = '${safeWorkerType}'
    AND attempts < max_attempts
    AND (
      (status = 'pending' AND (locked_until IS NULL OR locked_until <= NOW()))
      OR (status = 'claimed' AND locked_until IS NOT NULL AND locked_until < NOW())
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
`.trim()
}

export type ClaimedJobResult = {
  job: typeof jobQueue.$inferSelect
  eventPayload?: unknown
}

export async function claimJob(
  db: DbOrTx,
  workerType: string,
  workerId: string,
  leaseSeconds: number = 60
): Promise<ClaimedJobResult | null> {
  const query = buildClaimJobSql(workerType, workerId, leaseSeconds)
  const res = await (
    db as unknown as {
      execute: (query: unknown) => Promise<unknown>
    }
  ).execute(sql.raw(query))

  const rows = Array.isArray(res)
    ? res
    : ((res as { rows?: unknown[] })?.rows ?? [])
  const rawJob = (rows[0] as typeof jobQueue.$inferSelect) ?? null

  if (!rawJob) {
    return null
  }

  let eventPayload: unknown = null
  if (rawJob.event_id) {
    const dbClient = db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            limit: (n: number) => Promise<Array<{ payload: unknown }>>
          }
        }
      }
    }
    const [event] = await dbClient
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, rawJob.event_id))
      .limit(1)

    eventPayload = event?.payload ?? null
  }

  return {
    job: rawJob,
    eventPayload,
  }
}

export async function completeJob(
  db: DbOrTx,
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await (
    db as unknown as {
      update: (table: unknown) => {
        set: (values: Record<string, unknown>) => {
          where: (condition: unknown) => Promise<unknown>
        }
      }
    }
  )
    .update(jobQueue)
    .set({
      status: "completed",
      result: result ?? null,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .where(eq(jobQueue.id, jobId))

  // Dispatch post-completion side effects for domain events
  try {
    const dbClient = db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            limit: (n: number) => Promise<Array<typeof jobQueue.$inferSelect>>
          }
        }
      }
    }
    const [jobRecord] = await dbClient
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1)

    if (jobRecord?.event_id) {
      const eventClient = db as unknown as {
        select: () => {
          from: (table: unknown) => {
            where: (condition: unknown) => {
              limit: (
                n: number
              ) => Promise<Array<typeof domainEvents.$inferSelect>>
            }
          }
        }
      }
      const [eventRecord] = await eventClient
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.id, jobRecord.event_id))
        .limit(1)

      if (eventRecord) {
        const payload = (eventRecord.payload as Record<string, unknown>) || {}
        if (eventRecord.event_type === "analyst.query_requested") {
          const conversationId =
            (payload.conversationId as string) ||
            (result?.conversationId as string)
          if (conversationId) {
            const answer =
              (result?.content as string) ||
              (result?.answer as string) ||
              "Analysis complete."
            const insertClient = db as unknown as {
              insert: (table: unknown) => {
                values: (val: unknown) => Promise<unknown>
              }
            }
            await insertClient.insert(analystMessages).values({
              conversation_id: conversationId,
              sender: "assistant",
              content: answer,
              reasoning_trace:
                result?.reasoning_trace ?? result?.reasoningTrace ?? null,
              subgraph: result?.subgraph ?? null,
              citations: result?.citations ?? null,
            })

            const updateConvClient = db as unknown as {
              update: (table: unknown) => {
                set: (val: unknown) => {
                  where: (condition: unknown) => Promise<unknown>
                }
              }
            }
            await updateConvClient
              .update(analystConversations)
              .set({ updated_at: new Date().toISOString() })
              .where(eq(analystConversations.id, conversationId))
          }
        } else if (
          eventRecord.event_type === "analyst.drift_analysis_requested"
        ) {
          const contradictions =
            (result?.contradictions as Array<Record<string, unknown>>) || []
          if (contradictions.length > 0) {
            const insertClient = db as unknown as {
              insert: (table: unknown) => {
                values: (val: unknown) => Promise<unknown>
              }
            }
            for (const c of contradictions) {
              await insertClient.insert(knowledgeContradictions).values({
                ontology_id:
                  (c.ontologyId as string) || eventRecord.aggregate_id,
                group_key: (c.groupKey as string) || "shared",
                entity_id: String(c.entityId || "entity"),
                entity_label: String(c.entityLabel || c.entityId || "Entity"),
                relation_name: String(c.relationName || "relation"),
                conflict_type: String(c.conflictType || "value_mismatch"),
                fact_a: c.factA || {},
                fact_b: c.factB || {},
                explanation: String(c.explanation || "Contradiction detected"),
                status: "open",
                resolution_action: null,
              })
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal if domain post-processing encountered error
  }
}

export async function failJob(
  db: DbOrTx,
  jobId: string,
  errorMessage: string,
  currentAttempts: number,
  maxAttempts: number = 3
): Promise<{ status: "failed" | "pending"; nextRetryDelaySeconds?: number }> {
  const isDeadLetter = shouldMoveToDeadLetter(currentAttempts, maxAttempts)
  const backoff = calculateRetryBackoff(currentAttempts)
  const dbClient = db as unknown as {
    update: (table: unknown) => {
      set: (values: Record<string, unknown>) => {
        where: (condition: unknown) => Promise<unknown>
      }
    }
  }

  if (isDeadLetter) {
    await dbClient
      .update(jobQueue)
      .set({
        status: "failed",
        error_details: errorMessage,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(jobQueue.id, jobId))

    // If analyst query failed permanently, write assistant error message so UI doesn't hang
    try {
      const selectClient = db as unknown as {
        select: () => {
          from: (table: unknown) => {
            where: (condition: unknown) => {
              limit: (n: number) => Promise<Array<typeof jobQueue.$inferSelect>>
            }
          }
        }
      }
      const [jobRecord] = await selectClient
        .select()
        .from(jobQueue)
        .where(eq(jobQueue.id, jobId))
        .limit(1)

      if (jobRecord?.event_id) {
        const eventClient = db as unknown as {
          select: () => {
            from: (table: unknown) => {
              where: (condition: unknown) => {
                limit: (
                  n: number
                ) => Promise<Array<typeof domainEvents.$inferSelect>>
              }
            }
          }
        }
        const [eventRecord] = await eventClient
          .select()
          .from(domainEvents)
          .where(eq(domainEvents.id, jobRecord.event_id))
          .limit(1)

        if (eventRecord?.event_type === "analyst.query_requested") {
          const payload = (eventRecord.payload as Record<string, unknown>) || {}
          const conversationId = payload.conversationId as string
          if (conversationId) {
            const insertClient = db as unknown as {
              insert: (table: unknown) => {
                values: (val: unknown) => Promise<unknown>
              }
            }
            await insertClient.insert(analystMessages).values({
              conversation_id: conversationId,
              sender: "assistant",
              content: `Sorry, I encountered an error while processing the knowledge graph query: ${errorMessage}. Please check service health and try again.`,
              reasoning_trace: [{ step: "Job Failure", detail: errorMessage }],
              subgraph: null,
              citations: null,
            })
          }
        }
      }
    } catch {
      // Non-fatal
    }

    return { status: "failed" }
  }

  // Delay the next retry attempt using locked_until in the future
  const retryAt = new Date(Date.now() + backoff * 1000).toISOString()

  await dbClient
    .update(jobQueue)
    .set({
      status: "pending",
      error_details: errorMessage,
      locked_until: retryAt,
      updated_at: new Date().toISOString(),
    })
    .where(eq(jobQueue.id, jobId))

  return { status: "pending", nextRetryDelaySeconds: backoff }
}

export async function fastPathAwaitJob<T = unknown>(
  db: DbOrTx,
  jobId: string,
  timeoutMs: number = 2000,
  pollIntervalMs: number = 100
): Promise<{ resolved: boolean; status?: string; result?: T; error?: string }> {
  const startTime = Date.now()
  const dbClient = db as unknown as {
    select: () => {
      from: (table: unknown) => {
        where: (condition: unknown) => {
          limit: (n: number) => Promise<Array<Record<string, unknown>>>
        }
      }
    }
  }

  while (Date.now() - startTime < timeoutMs) {
    const [job] = await dbClient
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1)

    if (job) {
      if (job.status === "completed") {
        return { resolved: true, status: "completed", result: job.result as T }
      }
      if (job.status === "failed") {
        return {
          resolved: true,
          status: "failed",
          error: (job.error_details as string) || "Job failed",
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return { resolved: false }
}
