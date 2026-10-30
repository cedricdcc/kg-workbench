CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid,
	"target_worker" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"result" jsonb,
	"error_details" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ontology_cq_triples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"cq_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"subject_class_id" uuid,
	"predicate_relation_id" uuid,
	"object_class_id" uuid,
	"subject_example_id" uuid,
	"predicate_example_id" uuid,
	"object_example_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_endpoint_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_key" text DEFAULT 'shared' NOT NULL,
	"provider_id" text NOT NULL,
	"endpoint_url" text NOT NULL,
	"status_code" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"query_params" text,
	"response_payload" text NOT NULL,
	"detected_vocab_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_services" (
	"id" text PRIMARY KEY,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"capabilities" jsonb NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "job_queue_worker_status_priority_idx" ON "job_queue" ("target_worker","status","priority");--> statement-breakpoint
CREATE INDEX "idx_cq_triples_cq_id" ON "ontology_cq_triples" ("cq_id");--> statement-breakpoint
ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_event_id_domain_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ADD CONSTRAINT "ontology_cq_triples_cq_id_ontology_competency_questions_id_fkey" FOREIGN KEY ("cq_id") REFERENCES "ontology_competency_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ADD CONSTRAINT "ontology_cq_triples_subject_class_id_ontology_classes_id_fkey" FOREIGN KEY ("subject_class_id") REFERENCES "ontology_classes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ADD CONSTRAINT "ontology_cq_triples_sxShSurKGilr_fkey" FOREIGN KEY ("predicate_relation_id") REFERENCES "ontology_relations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ADD CONSTRAINT "ontology_cq_triples_object_class_id_ontology_classes_id_fkey" FOREIGN KEY ("object_class_id") REFERENCES "ontology_classes"("id") ON DELETE SET NULL;