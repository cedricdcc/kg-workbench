import type { DatabaseInsert, DatabaseRow } from "./database"
import {
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
  ontologyDocuments,
} from "@/server/db/schema"

export type OntologyDocument = DatabaseRow<typeof ontologyDocuments>
export type OntologyDocumentInsert = DatabaseInsert<typeof ontologyDocuments>

export interface OntologyModule {
  id: string
  ontology_id: string
  name: string
  description: string
}
export type OntologyModuleInsert = {
  id?: string
  ontology_id: string
  name: string
  description?: string
}

export interface OntologyClass {
  id: string
  ontology_id: string
  module_id: string | null
  name: string
  description: string
  parent_class_id: string | null
  instance_policy: string
}
export type OntologyClassInsert = {
  id?: string
  ontology_id: string
  module_id?: string | null
  name: string
  description?: string
  parent_class_id?: string | null
  instance_policy?: string
}

export interface OntologyAttribute {
  id: string
  class_id: string
  name: string
  data_type: string
  required: boolean | null
  description: string
}
export type OntologyAttributeInsert = {
  id?: string
  class_id: string
  name: string
  data_type?: string
  required?: boolean | null
  description?: string
}

export interface OntologyRelation {
  id: string
  ontology_id: string
  name: string
  domain_class_id: string
  range_class_id: string
  description: string
  inverse_name: string | null
  cardinality: string | null
  instance_policy: string
}
export type OntologyRelationInsert = {
  id?: string
  ontology_id: string
  name: string
  domain_class_id: string
  range_class_id: string
  description?: string
  inverse_name?: string | null
  cardinality?: string | null
  instance_policy?: string
}

export interface OntologyLanguage {
  id: string
  ontology_id: string
  language_code: string
  label: string
}
export type OntologyLanguageInsert = {
  id?: string
  ontology_id: string
  language_code: string
  label?: string
}

export interface OntologyCompetencyQuestion {
  id: string
  ontology_id: string
  question: string
  module_id?: string | null
  subject_class_id: string | null
  predicate_relation_id: string | null
  object_class_id: string | null
  subject_example_id: string | null
  predicate_example_id: string | null
  object_example_id: string | null
  sort_order: number
  created_at: string
}

export type OntologyCompetencyQuestionInsert = {
  id?: string
  ontology_id: string
  question?: string
  module_id?: string | null
  subject_class_id?: string | null
  predicate_relation_id?: string | null
  object_class_id?: string | null
  subject_example_id?: string | null
  predicate_example_id?: string | null
  object_example_id?: string | null
  sort_order?: number
  created_at?: string
}

export interface OntologyCqTriple {
  id: string
  cq_id: string
  sort_order: number
  subject_class_id: string | null
  predicate_relation_id: string | null
  object_class_id: string | null
  subject_example_id: string | null
  predicate_example_id: string | null
  object_example_id: string | null
  created_at: string
}

export type OntologyCqTripleInsert = {
  id?: string
  cq_id: string
  sort_order?: number
  subject_class_id?: string | null
  predicate_relation_id?: string | null
  object_class_id?: string | null
  subject_example_id?: string | null
  predicate_example_id?: string | null
  object_example_id?: string | null
  created_at?: string
}

export interface OntologyCompetencyQuestionModule {
  cq_id: string
  module_id: string
}

export interface OntologyRelationAttribute {
  id: string
  relation_id: string
  name: string
  data_type: string
  description: string
  required: boolean
  sort_order: number
  created_at: string
}
export type OntologyRelationAttributeInsert = {
  id?: string
  relation_id: string
  name: string
  data_type?: string
  description?: string
  required?: boolean
  sort_order?: number
  created_at?: string
}

export interface OntologyNote {
  id: string
  ontology_id: string
  body: string
  author_name: string
  sort_order: number
  created_at: string
  target_ontology_id: string | null
  target_module_id: string | null
  target_class_id: string | null
  target_relation_id: string | null
  target_attribute_id: string | null
  target_relation_attribute_id: string | null
  target_cq_id: string | null
}
export type OntologyNoteInsert = {
  id?: string
  ontology_id: string
  body?: string
  author_name?: string
  sort_order?: number
  created_at?: string
  target_ontology_id?: string | null
  target_module_id?: string | null
  target_class_id?: string | null
  target_relation_id?: string | null
  target_attribute_id?: string | null
  target_relation_attribute_id?: string | null
  target_cq_id?: string | null
}

export interface OntologyLocalizedText {
  id: string
  ontology_id: string
  field_name: string
  language_code: string
  value: string
  target_ontology_id: string | null
  target_module_id: string | null
  target_class_id: string | null
  target_relation_id: string | null
  target_attribute_id: string | null
  target_relation_attribute_id: string | null
  target_cq_id: string | null
}
export type OntologyLocalizedTextInsert = {
  id?: string
  ontology_id: string
  field_name: string
  language_code: string
  value?: string
  target_ontology_id?: string | null
  target_module_id?: string | null
  target_class_id?: string | null
  target_relation_id?: string | null
  target_attribute_id?: string | null
  target_relation_attribute_id?: string | null
  target_cq_id?: string | null
}

export interface OntologyExample {
  id: string
  ontology_id: string
  value: string
  subject_label: string | null
  predicate_label: string | null
  object_label: string | null
  sort_order: number
  created_at: string
  is_instance_candidate: boolean
  target_class_id: string | null
  target_attribute_id: string | null
  target_relation_id: string | null
  target_relation_attribute_id: string | null
  target_cq_id: string | null
}
export type OntologyExampleInsert = {
  id?: string
  ontology_id: string
  value: string
  subject_label?: string | null
  predicate_label?: string | null
  object_label?: string | null
  sort_order?: number
  created_at?: string
  is_instance_candidate?: boolean
  target_class_id?: string | null
  target_attribute_id?: string | null
  target_relation_id?: string | null
  target_relation_attribute_id?: string | null
  target_cq_id?: string | null
}

export interface OntologyClassRestriction {
  id: string
  ontology_id: string
  class_id: string
  relation_id: string | null
  attribute_id: string | null
  restriction_type: string
  cardinality_value: number
  created_at: string | null
}

export interface OntologyClassDisjointness {
  ontology_id: string
  class_id: string
  disjoint_class_id: string
}

export interface OntologyClassPosition {
  class_id: string
  module_id: string
  ontology_id: string
  x: number
  y: number
}

export interface OntologyModuleLayout {
  module_id: string
  ontology_id: string
  x: number
  y: number
  width: number
  height: number
}
