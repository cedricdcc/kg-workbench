"use server"

import crypto from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { getDb } from "@/server/db"
import { datasetSources, domainEvents } from "@/server/db/schema"
import {
  encryptSecret,
  decryptSecret,
  type EncryptedSecretPayload,
} from "@/server/crypto"
import { publishDomainEvent } from "@/server/events/outbox"
import { fastPathAwaitJob } from "@/server/events/fast-path"
import type { DbOrTx } from "@/server/events/types"
import type { TabularProfileResult } from "../../types"

export interface RemoteDbConnectionInput {
  dbType: "postgres" | "mysql"
  host: string
  port: number
  database: string
  user: string
  password: string
  sslMode?: "disable" | "prefer" | "require"
  ontologyId: string
}

export interface RemoteDbConnectionConfig {
  dbType: "postgres" | "mysql"
  host: string
  port: number
  database: string
  user: string
  schema?: string
  table?: string
  sslMode?: "disable" | "prefer" | "require"
  encryptedPassword: EncryptedSecretPayload
}

export type TableDiscoveryItem = {
  schema: string
  name: string
  type: string
  estimatedRows?: number
}

export type DiscoverRemoteTablesResult =
  | { success: true; tables: TableDiscoveryItem[] }
  | { success: false; error: string }

export type ProfileRemoteTableResult =
  | {
      success: true
      profile: TabularProfileResult
      connectionConfig?: RemoteDbConnectionConfig
    }
  | { success: false; error: string }

export type ResyncDatabaseSourceResult =
  | { success: true; profile: TabularProfileResult }
  | { success: false; error: string }

/**
 * Scrubs plaintext/encrypted credentials from outbox domain_events row upon job completion.
 */
export async function scrubDomainEventPassword(
  db: DbOrTx,
  eventId?: string
): Promise<void> {
  if (!eventId) return

  try {
    await (
      db as unknown as {
        execute: (query: unknown) => Promise<unknown>
      }
    ).execute(
      sql`UPDATE domain_events SET payload = payload - 'password' WHERE id = ${eventId}`
    )
  } catch {
    try {
      const dbClient = db as unknown as {
        select: () => {
          from: (table: unknown) => {
            where: (cond: unknown) => {
              limit: (n: number) => Promise<Array<Record<string, unknown>>>
            }
          }
        }
        update: (table: unknown) => {
          set: (data: unknown) => {
            where: (cond: unknown) => Promise<unknown>
          }
        }
      }
      const [eventRow] = await dbClient
        .select()
        .from(domainEvents)
        .where(eq(domainEvents.id, eventId))
        .limit(1)

      if (
        eventRow &&
        typeof eventRow.payload === "object" &&
        eventRow.payload !== null &&
        "password" in eventRow.payload
      ) {
        const cleaned = { ...(eventRow.payload as Record<string, unknown>) }
        delete cleaned.password
        await dbClient
          .update(domainEvents)
          .set({ payload: cleaned })
          .where(eq(domainEvents.id, eventId))
      }
    } catch {
      // Ignore fallback errors
    }
  }
}

/**
 * Discovers accessible schemas and tables across a remote PostgreSQL or MySQL database.
 */
export async function discoverRemoteTablesAction(
  input: RemoteDbConnectionInput,
  dbInstance?: DbOrTx
): Promise<DiscoverRemoteTablesResult> {
  if (!input.ontologyId) {
    return { success: false, error: "ontologyId is required." }
  }
  if (!input.dbType || !["postgres", "mysql"].includes(input.dbType)) {
    return {
      success: false,
      error: "Valid dbType ('postgres' | 'mysql') is required.",
    }
  }
  if (!input.host || !input.database || !input.user) {
    return { success: false, error: "Host, database, and user are required." }
  }

  const db = dbInstance ?? getDb()
  const encryptedPassword = encryptSecret(input.password ?? "")
  const aggregateId = crypto.randomUUID()

  let eventId: string | undefined
  let jobId: string | undefined

  try {
    const published = await publishDomainEvent(
      db,
      {
        eventType: "tabular.db_discover_requested",
        aggregateType: "dataset",
        aggregateId,
        payload: {
          dbType: input.dbType,
          host: input.host,
          port: input.port,
          database: input.database,
          user: input.user,
          password: encryptedPassword,
          sslMode: input.sslMode ?? "prefer",
          ontologyId: input.ontologyId,
        },
      },
      { priority: 100, targetWorker: "tabular" }
    )
    eventId = published.eventId
    jobId = published.jobId

    const awaitRes = await fastPathAwaitJob<{ tables: TableDiscoveryItem[] }>(
      db,
      jobId,
      10000,
      100
    )

    if (awaitRes.resolved && awaitRes.status === "completed" && awaitRes.result) {
      return {
        success: true,
        tables: awaitRes.result.tables || [],
      }
    }

    if (awaitRes.resolved && awaitRes.status === "failed") {
      return {
        success: false,
        error: awaitRes.error || "Remote database table discovery failed.",
      }
    }

    return {
      success: false,
      error: "Remote database table discovery timed out.",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (eventId) {
      await scrubDomainEventPassword(db, eventId)
    }
  }
}

/**
 * Profiles a selected table from a remote PostgreSQL or MySQL database.
 */
export async function profileRemoteTableAction(
  input: RemoteDbConnectionInput & { schema: string; table: string },
  dbInstance?: DbOrTx
): Promise<ProfileRemoteTableResult> {
  if (!input.ontologyId) {
    return { success: false, error: "ontologyId is required." }
  }
  if (!input.dbType || !["postgres", "mysql"].includes(input.dbType)) {
    return {
      success: false,
      error: "Valid dbType ('postgres' | 'mysql') is required.",
    }
  }
  if (!input.host || !input.database || !input.user) {
    return { success: false, error: "Host, database, and user are required." }
  }
  if (!input.table) {
    return { success: false, error: "Table name is required." }
  }

  const db = dbInstance ?? getDb()
  const encryptedPassword = encryptSecret(input.password ?? "")
  const aggregateId = crypto.randomUUID()
  const schema =
    input.schema || (input.dbType === "mysql" ? input.database : "public")

  let eventId: string | undefined
  let jobId: string | undefined

  try {
    const published = await publishDomainEvent(
      db,
      {
        eventType: "tabular.db_profile_requested",
        aggregateType: "dataset",
        aggregateId,
        payload: {
          dbType: input.dbType,
          host: input.host,
          port: input.port,
          database: input.database,
          user: input.user,
          password: encryptedPassword,
          sslMode: input.sslMode ?? "prefer",
          schema,
          table: input.table,
          ontologyId: input.ontologyId,
        },
      },
      { priority: 100, targetWorker: "tabular" }
    )
    eventId = published.eventId
    jobId = published.jobId

    const awaitRes = await fastPathAwaitJob<TabularProfileResult>(
      db,
      jobId,
      15000,
      100
    )

    if (awaitRes.resolved && awaitRes.status === "completed" && awaitRes.result) {
      const connectionConfig: RemoteDbConnectionConfig = {
        dbType: input.dbType,
        host: input.host,
        port: input.port,
        database: input.database,
        user: input.user,
        schema,
        table: input.table,
        sslMode: input.sslMode ?? "prefer",
        encryptedPassword,
      }

      return {
        success: true,
        profile: awaitRes.result,
        connectionConfig,
      }
    }

    if (awaitRes.resolved && awaitRes.status === "failed") {
      return {
        success: false,
        error: awaitRes.error || "Remote database table profiling failed.",
      }
    }

    return {
      success: false,
      error: "Remote database table profiling timed out.",
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (eventId) {
      await scrubDomainEventPassword(db, eventId)
    }
  }
}

/**
 * Re-syncs metrics and preview rows for an existing database dataset source.
 */
export async function resyncDatabaseSourceAction(
  datasetSourceId: string,
  dbInstance?: DbOrTx
): Promise<ResyncDatabaseSourceResult> {
  if (!datasetSourceId) {
    return { success: false, error: "datasetSourceId is required." }
  }

  const db = dbInstance ?? getDb()

  try {
    const dbClient = db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (cond: unknown) => {
            limit: (n: number) => Promise<Array<Record<string, unknown>>>
          }
        }
      }
      update: (table: unknown) => {
        set: (data: unknown) => {
          where: (cond: unknown) => Promise<unknown>
        }
      }
    }

    const [record] = await dbClient
      .select()
      .from(datasetSources)
      .where(eq(datasetSources.id, datasetSourceId))
      .limit(1)

    if (!record) {
      return {
        success: false,
        error: `Dataset source '${datasetSourceId}' not found.`,
      }
    }

    const connectionConfig = record.connection_config as
      | RemoteDbConnectionConfig
      | null
      | undefined

    if (!connectionConfig) {
      return {
        success: false,
        error: `Dataset source '${datasetSourceId}' does not have a database connection configuration.`,
      }
    }

    let decryptedPassword = ""
    if (connectionConfig.encryptedPassword) {
      const { ciphertext, iv, tag } = connectionConfig.encryptedPassword
      try {
        decryptedPassword = decryptSecret(ciphertext, iv, tag)
      } catch {
        return {
          success: false,
          error: "Failed to decrypt saved database credentials.",
        }
      }
    }

    const schema = connectionConfig.schema || "public"
    const table =
      connectionConfig.table || (record.source_name as string)

    const profileOutcome = await profileRemoteTableAction(
      {
        ontologyId: record.ontology_id as string,
        dbType: connectionConfig.dbType,
        host: connectionConfig.host,
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.user,
        password: decryptedPassword,
        sslMode: connectionConfig.sslMode,
        schema,
        table,
      },
      db
    )

    if (!profileOutcome.success) {
      return {
        success: false,
        error: profileOutcome.error || "Failed to re-sync dataset profile.",
      }
    }

    const profile = profileOutcome.profile
    const now = new Date()

    await dbClient
      .update(datasetSources)
      .set({
        row_count: profile.rowCount,
        column_count: profile.columnCount,
        profile_summary: {
          rowCount: profile.rowCount,
          columnCount: profile.columnCount,
          candidateKeys: profile.candidateKeys,
          columns: profile.columns,
        },
        sample_rows: profile.previewRows,
        last_synced_at: now,
        updated_at: now.toISOString(),
      })
      .where(eq(datasetSources.id, datasetSourceId))

    return {
      success: true,
      profile,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
