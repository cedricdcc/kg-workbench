CREATE TABLE "analyst_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" uuid,
	"group_key" text DEFAULT 'shared' NOT NULL,
	"title" text DEFAULT 'New Analysis' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analyst_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"conversation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"content" text NOT NULL,
	"reasoning_trace" jsonb,
	"subgraph" jsonb,
	"citations" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_contradictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" uuid,
	"group_key" text DEFAULT 'shared' NOT NULL,
	"entity_id" text NOT NULL,
	"entity_label" text NOT NULL,
	"relation_name" text NOT NULL,
	"conflict_type" text NOT NULL,
	"fact_a" jsonb NOT NULL,
	"fact_b" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_action" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analyst_conversations" ADD CONSTRAINT "analyst_conversations_ontology_id_ontology_documents_id_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "analyst_messages" ADD CONSTRAINT "analyst_messages_conversation_id_analyst_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "analyst_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "knowledge_contradictions" ADD CONSTRAINT "knowledge_contradictions_ontology_id_ontology_documents_id_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE CASCADE;