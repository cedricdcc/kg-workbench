import type {
  OntologyDefect,
  OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import type {
  RedundancyCluster,
  RecommendedVocabulary,
} from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

export type OntologyIssuesTab = "defects" | "redundancies" | "standards"

export interface OntologyIssuesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: OntologyDefectReport
  redundancyClusters?: RedundancyCluster[]
  recommendedVocabularies?: RecommendedVocabulary[]
  isLoadingAnalysis?: boolean
  analysisError?: Error | null
  onSelectEntity: (id: string, kind: "class" | "relation") => void
  onSuppress: (defectId: string) => void
  onRestore: (defectId: string) => void
  onQuickFix?: (defect: OntologyDefect) => void
  onImportVocabulary?: (vocab: RecommendedVocabulary) => Promise<void>
  importingPrefix?: string | null
  onOpenVocabularies?: () => void
  onSelectClassForRefactor?: (classId: string) => void
  defaultFullscreen?: boolean
}
