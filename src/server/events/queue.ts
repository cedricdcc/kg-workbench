import { eq } from "drizzle-orm"
import { jobQueue } from "../db/schema"
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
    AND (
      status = 'pending'
      OR (status = 'claimed' AND locked_until IS NOT NULL AND locked_until < NOW())
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
`.trim()
}

export async function completeJob(
  db: DbOrTx,
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> {
  await (db as unknown as {
    update: (table: unknown) => {
      set: (values: Record<string, unknown>) => {
        where: (condition: unknown) => Promise<unknown>
      }
    }
  })
    .update(jobQueue)
    .set({
      status: "completed",
      result: result ?? null,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .where(eq(jobQueue.id, jobId))
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

    return { status: "failed" }
  }

  await dbClient
    .update(jobQueue)
    .set({
      status: "pending",
      error_details: errorMessage,
      locked_until: null,
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
