ALTER TABLE "document_entities" DROP CONSTRAINT IF EXISTS "document_entities_class_id_fkey";--> statement-breakpoint
ALTER TABLE "entity_attribute_values" DROP CONSTRAINT IF EXISTS "entity_attribute_values_attribute_id_fkey";--> statement-breakpoint
ALTER TABLE "fact_relation_attribute_values" DROP CONSTRAINT IF EXISTS "fact_relation_attribute_values_relation_attribute_id_fkey";--> statement-breakpoint
ALTER TABLE "facts" DROP CONSTRAINT IF EXISTS "facts_relation_type_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_question_modules" DROP CONSTRAINT IF EXISTS "ontology_competency_question_modules_module_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_subject_class_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_predicate_relation_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_object_class_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_subject_example_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_predicate_example_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" DROP CONSTRAINT IF EXISTS "ontology_competency_questions_object_example_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" DROP CONSTRAINT IF EXISTS "ontology_cq_triples_subject_class_id_ontology_classes_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" DROP CONSTRAINT IF EXISTS "ontology_cq_triples_sxShSurKGilr_fkey";--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" DROP CONSTRAINT IF EXISTS "ontology_cq_triples_object_class_id_ontology_classes_id_fkey";--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD COLUMN IF NOT EXISTS "ohi_lockfile_snapshot" jsonb DEFAULT 'null';--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD COLUMN IF NOT EXISTS "ontology_sha256" text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ADD COLUMN IF NOT EXISTS "module_id" text;--> statement-breakpoint
ALTER TABLE "ontology_documents" ADD COLUMN IF NOT EXISTS "linkml_yaml" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ontology_documents" ADD COLUMN IF NOT EXISTS "ohi_yaml" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ontology_documents" ADD COLUMN IF NOT EXISTS "ohi_lockfile" jsonb DEFAULT 'null';--> statement-breakpoint
ALTER TABLE "ontology_documents" ADD COLUMN IF NOT EXISTS "ui_layout" jsonb DEFAULT '{"classPositions":{},"moduleLayouts":{}}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ontology_documents" ADD COLUMN IF NOT EXISTS "compiled_artifacts" jsonb DEFAULT 'null';--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "ontology_id" uuid;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "publication_url" text;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "artifact_url" text;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "artifact_format" text DEFAULT 'linkml-yaml' NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "sha256" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "artifact_content" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_ontologies" ADD COLUMN IF NOT EXISTS "is_transitive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_entities" ALTER COLUMN "class_id" SET DATA TYPE text USING "class_id"::text;--> statement-breakpoint
ALTER TABLE "entity_attribute_values" ALTER COLUMN "attribute_id" SET DATA TYPE text USING "attribute_id"::text;--> statement-breakpoint
ALTER TABLE "fact_relation_attribute_values" ALTER COLUMN "relation_attribute_id" SET DATA TYPE text USING "relation_attribute_id"::text;--> statement-breakpoint
ALTER TABLE "facts" ALTER COLUMN "relation_type_id" SET DATA TYPE text USING "relation_type_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_question_modules" ALTER COLUMN "module_id" SET DATA TYPE text USING "module_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "subject_class_id" SET DATA TYPE text USING "subject_class_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "predicate_relation_id" SET DATA TYPE text USING "predicate_relation_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "object_class_id" SET DATA TYPE text USING "object_class_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "subject_example_id" SET DATA TYPE text USING "subject_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "predicate_example_id" SET DATA TYPE text USING "predicate_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_competency_questions" ALTER COLUMN "object_example_id" SET DATA TYPE text USING "object_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "subject_class_id" SET DATA TYPE text USING "subject_class_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "predicate_relation_id" SET DATA TYPE text USING "predicate_relation_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "object_class_id" SET DATA TYPE text USING "object_class_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "subject_example_id" SET DATA TYPE text USING "subject_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "predicate_example_id" SET DATA TYPE text USING "predicate_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_cq_triples" ALTER COLUMN "object_example_id" SET DATA TYPE text USING "object_example_id"::text;--> statement-breakpoint
ALTER TABLE "ontology_documents" ALTER COLUMN "version" SET DEFAULT '1.0.0';--> statement-breakpoint
ALTER TABLE "reference_ontologies" ALTER COLUMN "source_registry" SET DEFAULT 'ohi';--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reference_ontologies_ontology_id_ontology_documents_id_fkey'
  ) THEN
    ALTER TABLE "reference_ontologies" ADD CONSTRAINT "reference_ontologies_ontology_id_ontology_documents_id_fkey" FOREIGN KEY ("ontology_id") REFERENCES "ontology_documents"("id") ON DELETE CASCADE;
  END IF;
END $$;
