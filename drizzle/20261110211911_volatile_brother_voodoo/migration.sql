ALTER TABLE "ontology_class_disjointness" DROP CONSTRAINT IF EXISTS "ontology_class_disjointness_class_id_ontology_classes_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_class_disjointness" DROP CONSTRAINT IF EXISTS "ontology_class_disjointness_Ob5RWGaH3Ky5_fkey";--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" DROP CONSTRAINT IF EXISTS "ontology_class_restrictions_class_id_ontology_classes_id_fkey";--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" DROP CONSTRAINT IF EXISTS "ontology_class_restrictions_i329QXfQZI4Z_fkey";--> statement-breakpoint
ALTER TABLE "ontology_class_restrictions" DROP CONSTRAINT IF EXISTS "ontology_class_restrictions_XXkGOKecTKlv_fkey";--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_attributes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_class_disjointness" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_class_positions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_class_restrictions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_classes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_examples" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_languages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_localized_texts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_module_layout" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_modules" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_relation_attributes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ontology_relations" CASCADE;
