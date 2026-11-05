import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb } from "@/server/db"
import { jobQueue } from "@/server/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Job id is required" }, { status: 400 })
    }

    const db = getDb()
    const [job] = await (db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            limit: (n: number) => Promise<Array<typeof jobQueue.$inferSelect>>
          }
        }
      }
    })
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, id))
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      targetWorker: job.target_worker,
      result: job.result,
      errorDetails: job.error_details,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
