CREATE TABLE "dataset_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" uuid NOT NULL,
	"group_key" text DEFAULT 'shared' NOT NULL,
	"source_name" text NOT NULL,
	"file_format" text NOT NULL,
	"row_count" integer NOT NULL,
	"column_count" integer NOT NULL,
	"profile_summary" jsonb NOT NULL,
	"sample_rows" jsonb NOT NULL,
	"mapping_spec" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "dataset_sources_ontology_id_idx" ON "dataset_sources" ("ontology_id");--> statement-breakpoint
CREATE INDEX "dataset_sources_group_key_idx" ON "dataset_sources" ("group_key");--> statement-breakpoint
ALTER TABLE "dataset_sources" ADD CONSTRAINT "dataset_sources_ontology_id_ontology_documents_id_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE CASCADE;