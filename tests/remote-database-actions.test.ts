import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

import { encryptSecret, decryptSecret } from "../src/server/crypto"
import { datasetSources, domainEvents, jobQueue } from "../src/server/db/schema"
import type { TabularProfileResult } from "../src/features/tabular/types"
import type { DbOrTx } from "../src/server/events/types"
import {
  discoverRemoteTablesAction,
  profileRemoteTableAction,
  resyncDatabaseSourceAction,
  type RemoteDbConnectionInput,
} from "../src/features/tabular/server/actions/remote-database"

function createMockDbHarness() {
  const events: Array<{ id: string; event_type: string; aggregate_type: string; aggregate_id: string; payload: Record<string, unknown> }> = []
  const jobs: Array<{ id: string; event_id: string; target_worker: string; status: string; priority: number; result: unknown; error_details?: string }> = []
  const sources: Array<Record<string, unknown>> = []
  const executedSql: string[] = []

  let nextJobResult: unknown = null
  let nextJobStatus: "completed" | "failed" = "completed"
  let nextJobError: string | undefined = undefined

  const mockDb = {
    _events: events,
    _jobs: jobs,
    _sources: sources,
    _executedSql: executedSql,
    setNextJobResult(result: unknown, status: "completed" | "failed" = "completed", error?: string) {
      nextJobResult = result
      nextJobStatus = status
      nextJobError = error
    },
    insert(table: unknown) {
      return {
        values(data: unknown) {
          return {
            returning() {
              const val = { ...(data as Record<string, unknown>) }
              const id = (val.id as string) || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
              val.id = id

              if (table === domainEvents) {
                events.push(val as (typeof events)[0])
              } else if (table === jobQueue) {
                const jobRecord = {
                  ...val,
                  status: nextJobStatus,
                  result: nextJobResult,
                  error_details: nextJobError,
                } as (typeof jobs)[0]
                jobs.push(jobRecord)
              } else if (table === datasetSources) {
                sources.push(val)
              }
              return Promise.resolve([val])
            },
          }
        },
      }
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === jobQueue) {
                    return Promise.resolve(jobs.slice(-1))
                  }
                  if (table === datasetSources) {
                    return Promise.resolve(sources.slice(-1))
                  }
                  if (table === domainEvents) {
                    return Promise.resolve(events.slice(-1))
                  }
                  return Promise.resolve([])
                },
              }
            },
          }
        },
      }
    },
    update(table: unknown) {
      return {
        set(updateData: unknown) {
          return {
            where() {
              if (table === datasetSources && sources.length > 0) {
                Object.assign(sources[sources.length - 1], updateData)
              } else if (table === domainEvents && events.length > 0) {
                Object.assign(events[events.length - 1], updateData)
              }
              return Promise.resolve([updateData])
            },
          }
        },
      }
    },
    execute(query: unknown) {
      const qStr = typeof query === "string" ? query : String((query as { text?: string })?.text || (query as { queryChunks?: unknown[] })?.queryChunks?.map(c => typeof c === "string" ? c : (c as { value?: string })?.value || "").join("") || "")
      executedSql.push(qStr)
      if (qStr.includes("domain_events") && qStr.includes("payload - 'password'")) {
        for (const ev of events) {
          if (ev.payload && "password" in ev.payload) {
            delete ev.payload.password
          }
        }
      }
      return Promise.resolve({ rows: [] })
    },
  }

  return { mockDb, events, jobs, sources, executedSql }
}

const sampleConnInput: RemoteDbConnectionInput = {
  dbType: "postgres",
  host: "db.internal.local",
  port: 5432,
  database: "inventory_db",
  user: "read_only_agent",
  password: "super-secret-password-xyz",
  sslMode: "require",
  ontologyId: "00000000-0000-0000-0000-000000000001",
}

const sampleProfileResult: TabularProfileResult = {
  fileName: "products",
  fileType: "postgres",
  rowCount: 1250,
  columnCount: 4,
  estimatedSizeBytes: 45000,
  columns: [
    {
      name: "id",
      duckdbType: "BIGINT",
      inferredKgType: "number",
      nullCount: 0,
      nullPercentage: 0,
      distinctCount: 1250,
      isUniqueCandidate: true,
      sampleValues: [1, 2, 3],
    },
    {
      name: "sku",
      duckdbType: "VARCHAR",
      inferredKgType: "string",
      nullCount: 0,
      nullPercentage: 0,
      distinctCount: 1250,
      isUniqueCandidate: true,
      sampleValues: ["SKU-001", "SKU-002"],
    },
  ],
  candidateKeys: [["id"], ["sku"]],
  previewRows: [
    { id: 1, sku: "SKU-001" },
    { id: 2, sku: "SKU-002" },
  ],
}

test("datasetSources schema exposes connection_config and last_synced_at", () => {
  assert.ok(datasetSources.connection_config, "connection_config column must exist on datasetSources")
  assert.ok(datasetSources.last_synced_at, "last_synced_at column must exist on datasetSources")
})

test("discoverRemoteTablesAction publishes event, awaits job, and scrubs password from outbox", async () => {
  const harness = createMockDbHarness()
  harness.mockDb.setNextJobResult({
    tables: [
      { schema: "public", name: "products", type: "BASE TABLE", estimatedRows: 1250 },
      { schema: "public", name: "orders", type: "BASE TABLE", estimatedRows: 50000 },
    ],
  })

  const result = await discoverRemoteTablesAction(sampleConnInput, harness.mockDb as unknown as DbOrTx)

  assert.equal(result.success, true, "discoverRemoteTablesAction should succeed")
  if (result.success) {
    assert.equal(result.tables.length, 2)
    assert.equal(result.tables[0].name, "products")
  }

  // Verify event was created
  assert.equal(harness.events.length, 1)
  const event = harness.events[0]
  assert.equal(event.event_type, "tabular.db_discover_requested")
  assert.equal(event.aggregate_type, "dataset")

  // Verify password scrubbing
  assert.equal(event.payload.password, undefined, "Password must be scrubbed from outbox payload")
  const scrubQueryFound = harness.executedSql.some((q) => q.includes("payload - 'password'"))
  assert.equal(scrubQueryFound, true, "UPDATE domain_events SET payload = payload - 'password' must be executed")
})

test("profileRemoteTableAction returns profile result with encrypted connection config", async () => {
  const harness = createMockDbHarness()
  harness.mockDb.setNextJobResult(sampleProfileResult)

  const result = await profileRemoteTableAction(
    {
      ...sampleConnInput,
      schema: "public",
      table: "products",
    },
    harness.mockDb as unknown as DbOrTx
  )

  assert.equal(result.success, true, "profileRemoteTableAction should succeed")
  if (result.success) {
    assert.equal(result.profile.rowCount, 1250)
    assert.equal(result.profile.columnCount, 4)
    assert.ok(result.connectionConfig, "connectionConfig should be present in result")

    const cfg = result.connectionConfig!
    assert.equal(cfg.dbType, "postgres")
    assert.equal(cfg.host, sampleConnInput.host)
    assert.equal(cfg.table, "products")
    assert.ok(cfg.encryptedPassword, "encryptedPassword must exist")

    // Verify encryptedPassword can be successfully decrypted back to plaintext
    const decrypted = decryptSecret(
      cfg.encryptedPassword.ciphertext,
      cfg.encryptedPassword.iv,
      cfg.encryptedPassword.tag
    )
    assert.equal(decrypted, sampleConnInput.password, "Decrypted password must match original plaintext")
  }

  // Verify event outbox password was scrubbed
  assert.equal(harness.events[0].payload.password, undefined, "Password scrubbed from event payload")
})

test("resyncDatabaseSourceAction decrypts saved connection config, re-runs profiling, and updates datasetSources", async () => {
  const harness = createMockDbHarness()
  const encryptedPassword = encryptSecret(sampleConnInput.password)

  // Seed existing datasetSource record with connection_config
  const initialSource = {
    id: "ds-source-001",
    ontology_id: sampleConnInput.ontologyId,
    group_key: "shared",
    source_name: "products",
    file_format: "postgres",
    row_count: 500, // old count
    column_count: 2, // old count
    profile_summary: {},
    sample_rows: [],
    connection_config: {
      dbType: "postgres",
      host: sampleConnInput.host,
      port: sampleConnInput.port,
      database: sampleConnInput.database,
      user: sampleConnInput.user,
      schema: "public",
      table: "products",
      sslMode: "require",
      encryptedPassword,
    },
    last_synced_at: null,
  }
  harness.sources.push(initialSource)
  harness.mockDb.setNextJobResult(sampleProfileResult)

  const result = await resyncDatabaseSourceAction("ds-source-001", harness.mockDb as unknown as DbOrTx)

  assert.equal(result.success, true, "resyncDatabaseSourceAction should succeed")
  if (result.success) {
    assert.equal(result.profile.rowCount, 1250)
  }

  // Verify datasetSource was updated in database
  const updated = harness.sources[0]
  assert.equal(updated.row_count, 1250, "row_count should be updated to fresh profile")
  assert.equal(updated.column_count, 4, "column_count should be updated")
  assert.ok(updated.last_synced_at, "last_synced_at should be populated")
})

test("discoverRemoteTablesAction handles job failure gracefully", async () => {
  const harness = createMockDbHarness()
  harness.mockDb.setNextJobResult(null, "failed", "Connection refused to remote host")

  const result = await discoverRemoteTablesAction(sampleConnInput, harness.mockDb as unknown as DbOrTx)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.ok(result.error.includes("Connection refused") || result.error.includes("failed"))
  }
})

test("resyncDatabaseSourceAction returns error for missing source or missing connection_config", async () => {
  const harness = createMockDbHarness()
  const result1 = await resyncDatabaseSourceAction("non-existent", harness.mockDb as unknown as DbOrTx)
  assert.equal(result1.success, false)

  harness.sources.push({
    id: "csv-source-without-config",
    ontology_id: sampleConnInput.ontologyId,
    source_name: "local.csv",
    file_format: "csv",
    connection_config: null,
  })
  const result2 = await resyncDatabaseSourceAction("csv-source-without-config", harness.mockDb as unknown as DbOrTx)
  assert.equal(result2.success, false)
  if (!result2.success) {
    assert.ok(result2.error.includes("connection configuration"))
  }
})
