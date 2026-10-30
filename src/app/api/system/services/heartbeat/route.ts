import { NextResponse } from "next/server"
import { getDb } from "@/server/db"
import {
  parseHeartbeatPayload,
  recordServiceHeartbeat,
} from "@/server/events/services"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = parseHeartbeatPayload(body)

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid heartbeat payload" },
        { status: 400 }
      )
    }

    const db = getDb()
    await recordServiceHeartbeat(db, payload)

    return NextResponse.json({ ok: true, id: payload.id })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
