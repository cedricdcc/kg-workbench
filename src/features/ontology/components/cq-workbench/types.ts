import type { OntologyModule } from "@/domain/ontology"

export type {
  CqCoverageSummary,
  EvaluatedCqCoverage,
} from "@/features/ontology/utils/cq-coverage"

export type CqCoverageFilter = "all" | "unmapped" | "covered"

export interface CqFilterState {
  search: string
  moduleId: string | null
  coverageFilter: CqCoverageFilter
}

export interface CqMetricsBarProps {
  summary: CqCoverageSummary
  modules: OntologyModule[]
  filters: CqFilterState
  onFilterChange: (updates: Partial<CqFilterState>) => void
  onAddQuestion: () => void
  onAiDraft: () => void
  isAiGenerating?: boolean
}

export interface CqConceptSelection {
  subjectClassId: string | null
  predicateRelationId: string | null
  objectClassId: string | null
}
