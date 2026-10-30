import { NextResponse } from "next/server"
import { getDb } from "@/server/db"
import { completeJob } from "@/server/events/queue"

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
    const db = getDb()
    await completeJob(db, id, body?.result)

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
