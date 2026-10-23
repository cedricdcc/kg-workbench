import { Client } from "pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config({ path: "deploy/.env.server" })

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

export async function runCqTriplesMigration(connectionString = databaseUrl) {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ontology_cq_triples (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cq_id uuid NOT NULL REFERENCES ontology_competency_questions(id) ON DELETE CASCADE,
        sort_order integer NOT NULL DEFAULT 0,
        subject_class_id uuid REFERENCES ontology_classes(id) ON DELETE SET NULL,
        predicate_relation_id uuid REFERENCES ontology_relations(id) ON DELETE SET NULL,
        object_class_id uuid REFERENCES ontology_classes(id) ON DELETE SET NULL,
        subject_example_id uuid,
        predicate_example_id uuid,
        object_example_id uuid,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_cq_triples_cq_id ON ontology_cq_triples(cq_id);

      INSERT INTO ontology_cq_triples (
        cq_id,
        sort_order,
        subject_class_id,
        predicate_relation_id,
        object_class_id,
        subject_example_id,
        predicate_example_id,
        object_example_id,
        created_at
      )
      SELECT
        id AS cq_id,
        0 AS sort_order,
        subject_class_id,
        predicate_relation_id,
        object_class_id,
        subject_example_id,
        predicate_example_id,
        object_example_id,
        created_at
      FROM ontology_competency_questions cq
      WHERE (cq.subject_class_id IS NOT NULL OR cq.predicate_relation_id IS NOT NULL OR cq.object_class_id IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM ontology_cq_triples t WHERE t.cq_id = cq.id
        );
    `)
    console.log("ontology_cq_triples table and backfill migration applied.")
  } finally {
    await client.end()
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate-cq-triples.mjs")) {
  runCqTriplesMigration().catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
}
