export type OntologyDefectSeverity = "error" | "warning" | "info"

export type OntologyDefectKind =
  | "subclass_cycle"
  | "dangling_relation_domain"
  | "dangling_relation_range"
  | "orphan_class"
  | "near_duplicate_class"
  | "near_duplicate_relation"
  | "competing_modelling_pattern"
  | "inverse_inconsistent"
  | "missing_description"
  | "class_without_attributes"

export type QuickFixType =
  | "clear_parent"
  | "delete_relation"
  | "focus_description"
  | "open_attributes"

export interface OntologyDefect {
  id: string
  kind: OntologyDefectKind
  severity: OntologyDefectSeverity
  targetType: "class" | "relation"
  targetId: string
  targetName: string
  title: string
  description: string
  suggestedAction?: string
  oopsPitfallId?: string
  quickFixType?: QuickFixType
}

export interface OntologyDefectReport {
  total: number
  counts: {
    error: number
    warning: number
    info: number
  }
  defects: OntologyDefect[]
  suppressed: OntologyDefect[]
  defectsByTargetId: Record<string, OntologyDefect[]>
  hasErrors: boolean
  hasWarnings: boolean
}
