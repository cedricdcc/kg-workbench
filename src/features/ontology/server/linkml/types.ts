/**
 * Canonical TypeScript types for LinkML engine, artifacts, visual layout, and snapshots.
 */

export interface OntologyUiLayout {
  /** Record<moduleId, Record<classId, { x: number; y: number }>> */
  classPositions: Record<string, Record<string, { x: number; y: number }>>
  /** Record<moduleId, { x: number; y: number; width: number; height: number }> */
  moduleLayouts: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >
}

export interface LinkmlLintIssue {
  issue_type: string
  severity: "FATAL" | "ERROR" | "WARNING" | "INFO" | string
  message: string
  element?: string
}

export interface CompiledOntologyArtifacts {
  source_sha256: string
  compiled_at: string
  shacl_ttl: string
  rdfs_ttl: string
  owl_ttl: string
  pydantic_py: string
  json_schema: string
  er_diagram: string
  lint_issues: LinkmlLintIssue[]
}

export type {
  OhiFormat,
  OhiDependencyRef,
  OhiManifest,
  OhiLockSelection,
  OhiLockedFile,
  OhiLockfileV2,
} from "../ohi/types"

export interface OntologyDocumentSnapshot {
  id: string
  name: string
  version?: string | null
  default_language?: string
  usecase?: string
  group_key?: string
  base_iri?: string
  prefixes?: Record<string, string>
  imports?: string[]
}

export interface OntologyModuleSnapshot {
  id: string
  name: string
  description?: string
}

export interface OntologyClassRestrictionSnapshot {
  id?: string
  class_id: string
  relation_id?: string | null
  attribute_id?: string | null
  restriction_type: string
  cardinality_value: number
}

export interface OntologyClassDisjointnessSnapshot {
  class_id: string
  disjoint_class_id: string
}

export interface OntologyClassSnapshot {
  id: string
  name: string
  description?: string
  module_id?: string | null
  parent_class_id?: string | null
  instance_policy?: string
  disjoint_with?: string[]
  disjoint_with_class_ids?: string[]
  attributes?: OntologyAttributeSnapshot[]
  restrictions?: OntologyClassRestrictionSnapshot[]
}

export interface OntologyAttributeSnapshot {
  id: string
  class_id: string
  name: string
  data_type?: string
  required?: boolean | null
  description?: string
}

export interface OntologyRelationSnapshot {
  id: string
  name: string
  domain_class_id: string
  range_class_id: string
  description?: string
  inverse_name?: string | null
  cardinality?: string | null
  instance_policy?: string
}

export interface OntologyRelationAttributeSnapshot {
  id: string
  relation_id: string
  name: string
  data_type?: string
  required?: boolean | null
  description?: string
  sort_order?: number
}

export interface OntologyNoteSnapshot {
  id?: string
  target_type:
    | "ontology"
    | "module"
    | "class"
    | "relation"
    | "attribute"
    | "relation_attribute"
    | "cq"
    | string
  target_id: string
  body: string
  author_name?: string
  sort_order?: number
}

export interface OntologyExampleSnapshot {
  id?: string
  target_type:
    "class" | "attribute" | "relation" | "relation_attribute" | "cq" | string
  target_id: string
  value: string
  subject_label?: string | null
  predicate_label?: string | null
  object_label?: string | null
  is_instance_candidate?: boolean
  sort_order?: number
}

export interface OntologyLocalizedTextSnapshot {
  id?: string
  target_type:
    | "ontology"
    | "module"
    | "class"
    | "relation"
    | "attribute"
    | "relation_attribute"
    | "cq"
    | string
  target_id: string
  field_name: string
  language_code: string
  value: string
}

/**
 * Full canonical snapshot representing an ontology document and all nested entities for AST mapping.
 */
export interface CanonicalOntologySnapshot {
  document: OntologyDocumentSnapshot
  modules: OntologyModuleSnapshot[]
  classes: OntologyClassSnapshot[]
  attributes: OntologyAttributeSnapshot[]
  relations: OntologyRelationSnapshot[]
  relation_attributes: OntologyRelationAttributeSnapshot[]
  restrictions?: OntologyClassRestrictionSnapshot[]
  disjointness?: OntologyClassDisjointnessSnapshot[]
  notes?: OntologyNoteSnapshot[]
  examples?: OntologyExampleSnapshot[]
  localized_texts?: OntologyLocalizedTextSnapshot[]
  ui_layout?: OntologyUiLayout
}
