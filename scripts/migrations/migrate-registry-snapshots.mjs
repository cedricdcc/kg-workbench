import { Client } from "pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: "deploy/.env.server" })

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:cbca93016c7c6612ba0c1bb0d1465c66@127.0.0.1:5433/postgres"

export async function runSnapshotsMigration(connectionString = databaseUrl) {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS registry_endpoint_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        group_key text NOT NULL DEFAULT 'shared',
        provider_id text NOT NULL,
        endpoint_url text NOT NULL,
        status_code integer NOT NULL,
        latency_ms integer NOT NULL,
        query_params text,
        response_payload text NOT NULL,
        detected_vocab_count integer NOT NULL DEFAULT 0,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `)
    console.log("registry_endpoint_snapshots table verified/created.")
  } finally {
    await client.end()
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate-registry-snapshots.mjs")) {
  runSnapshotsMigration().catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
}
