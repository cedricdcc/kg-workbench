import { NextResponse } from "next/server"
import { getDb } from "@/server/db"
import { failJob } from "@/server/events/queue"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Job id is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const errorMessage = body?.errorMessage || "Unknown error"
    const currentAttempts =
      typeof body?.currentAttempts === "number" ? body.currentAttempts : 1
    const maxAttempts =
      typeof body?.maxAttempts === "number" ? body.maxAttempts : 3

    const db = getDb()
    const res = await failJob(
      db,
      id,
      errorMessage,
      currentAttempts,
      maxAttempts
    )

    return NextResponse.json({
      ok: true,
      id,
      status: res.status,
      nextRetryDelaySeconds: res.nextRetryDelaySeconds,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
