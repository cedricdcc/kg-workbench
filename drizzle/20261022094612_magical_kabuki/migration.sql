CREATE TABLE "ontology_class_disjointness" (
	"ontology_id" uuid NOT NULL,
	"class_id" uuid,
	"disjoint_class_id" uuid,
	CONSTRAINT "ontology_class_disjointness_pkey" PRIMARY KEY("class_id","disjoint_class_id")
);
--> statement-breakpoint
CREATE TABLE "ontology_class_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"relation_id" uuid,
	"attribute_id" uuid,
	"restriction_type" text NOT NULL,
	"cardinality_value" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ontology_defect_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ontology_id" uuid NOT NULL,
	"defect_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reference_ontologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"prefix" text NOT NULL,
	"name" text NOT NULL,
	"base_iri" text NOT NULL,
	"source_registry" text NOT NULL,
	"source_id" text NOT NULL,
	"version" text DEFAULT '',
	"synced_at" timestamp with time zone DEFAULT now(),
	"group_key" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reference_ontology_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reference_ontology_id" uuid NOT NULL,
	"curie" text NOT NULL,
	"iri" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"property_kind" text,
	"description" text DEFAULT '' NOT NULL,
	"synonyms" text[] DEFAULT '{}'::text[],
	"parent_iris" text[] DEFAULT '{}'::text[],
	"domain_iris" text[] DEFAULT '{}'::text[],
	"range_iris" text[] DEFAULT '{}'::text[],
	"related_property_iris" text[] DEFAULT '{}'::text[],
	"embedding" real[],
	"group_key" text DEFAULT 'shared' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"iv" text NOT NULL,
	"tag" text NOT NULL,
	"key_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_api_keys_user_provider_idx" ON "user_api_keys" ("user_id","provider");--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_ontology_id_ontology_documents_id_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ontology_class_disjointness" ADD CONSTRAINT "ontology_class_disjointness_class_id_ontology_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "ontology_classes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_class_disjointness" ADD CONSTRAINT "ontology_class_disjointness_Ob5RWGaH3Ky5_fkey" FOREIGN KEY ("disjoint_class_id") REFERENCES "ontology_classes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" ADD CONSTRAINT "ontology_class_restrictions_class_id_ontology_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "ontology_classes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" ADD CONSTRAINT "ontology_class_restrictions_i329QXfQZI4Z_fkey" FOREIGN KEY ("relation_id") REFERENCES "ontology_relations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" ADD CONSTRAINT "ontology_class_restrictions_XXkGOKecTKlv_fkey" FOREIGN KEY ("attribute_id") REFERENCES "ontology_attributes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ontology_defect_suppressions" ADD CONSTRAINT "ontology_defect_suppressions_2xFhSGxOxOgx_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reference_ontology_terms" ADD CONSTRAINT "reference_ontology_terms_bBiu44At4fH7_fkey" FOREIGN KEY ("reference_ontology_id") REFERENCES "reference_ontologies"("id") ON DELETE CASCADE;