import { systemServices } from "../db/schema"
import type { DbOrTx } from "./types"

export type ServiceHeartbeatPayload = {
  id: string
  displayName: string
  capabilities: string[]
  metadata?: Record<string, unknown>
}

export type ServiceHealthStatus = "online" | "degraded" | "offline"

export function parseHeartbeatPayload(
  body: unknown
): ServiceHeartbeatPayload | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>

  if (typeof b.id !== "string" || !b.id.trim()) return null
  if (typeof b.displayName !== "string" || !b.displayName.trim()) return null
  if (!Array.isArray(b.capabilities)) return null

  return {
    id: b.id.trim(),
    displayName: b.displayName.trim(),
    capabilities: b.capabilities.filter((c): c is string => typeof c === "string"),
    metadata:
      b.metadata && typeof b.metadata === "object"
        ? (b.metadata as Record<string, unknown>)
        : undefined,
  }
}

export function calculateServiceHealth(
  lastHeartbeat: Date | string,
  thresholdSeconds: number = 30
): ServiceHealthStatus {
  const hbTime =
    typeof lastHeartbeat === "string"
      ? new Date(lastHeartbeat).getTime()
      : lastHeartbeat.getTime()
  const elapsedSeconds = Math.max(0, (Date.now() - hbTime) / 1000)

  if (elapsedSeconds <= thresholdSeconds) {
    return "online"
  }
  if (elapsedSeconds <= thresholdSeconds * 2) {
    return "degraded"
  }
  return "offline"
}

interface SystemServiceRow {
  id: string
  display_name: string
  status: string
  capabilities: string[]
  last_heartbeat: string
  metadata?: Record<string, unknown> | null
}

export async function recordServiceHeartbeat(
  db: DbOrTx,
  payload: ServiceHeartbeatPayload
): Promise<void> {
  const now = new Date().toISOString()
  const dbClient = db as unknown as {
    insert: (table: unknown) => {
      values: (val: Record<string, unknown>) => {
        onConflictDoUpdate: (config: {
          target: unknown
          set: Record<string, unknown>
        }) => Promise<unknown>
      }
    }
  }

  await dbClient
    .insert(systemServices)
    .values({
      id: payload.id,
      display_name: payload.displayName,
      status: "online",
      capabilities: payload.capabilities,
      last_heartbeat: now,
      metadata: payload.metadata ?? null,
    })
    .onConflictDoUpdate({
      target: systemServices.id,
      set: {
        display_name: payload.displayName,
        status: "online",
        capabilities: payload.capabilities,
        last_heartbeat: now,
        metadata: payload.metadata ?? null,
      },
    })
}

export async function getServiceRegistryStatuses(db: DbOrTx) {
  const dbClient = db as unknown as {
    select: () => {
      from: (table: unknown) => Promise<Array<SystemServiceRow>>
    }
  }
  const services = await dbClient.select().from(systemServices)
  return services.map((s) => ({
    id: s.id,
    displayName: s.display_name,
    status: calculateServiceHealth(s.last_heartbeat),
    capabilities: s.capabilities,
    lastHeartbeat: s.last_heartbeat,
    metadata: s.metadata,
  }))
}
