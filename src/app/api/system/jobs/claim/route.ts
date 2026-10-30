import { NextResponse } from "next/server"
import { getDb } from "@/server/db"
import { claimJob } from "@/server/events/queue"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { workerType, workerId, leaseSeconds } = body

    if (!workerType || typeof workerType !== "string") {
      return NextResponse.json(
        { error: "workerType string is required" },
        { status: 400 }
      )
    }

    if (!workerId || typeof workerId !== "string") {
      return NextResponse.json(
        { error: "workerId string is required" },
        { status: 400 }
      )
    }

    const lease = typeof leaseSeconds === "number" ? leaseSeconds : 60
    const db = getDb()
    const claimed = await claimJob(db, workerType, workerId, lease)

    if (!claimed) {
      return NextResponse.json({ ok: true, job: null, eventPayload: null })
    }

    return NextResponse.json({
      ok: true,
      job: claimed.job,
      eventPayload: claimed.eventPayload,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
