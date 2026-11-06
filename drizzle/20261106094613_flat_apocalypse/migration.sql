ALTER TABLE "dataset_sources" ADD COLUMN "connection_config" jsonb;--> statement-breakpoint
ALTER TABLE "dataset_sources" ADD COLUMN "last_synced_at" timestamp with time zone;