import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import type { OntologyRelation } from "@/domain/ontology"
import type { TermAlignmentCandidate } from "@/features/ontology/server/actions/reference-vocabularies"
import type { RelationReconciliationDecision } from "@/features/ontology/schemas/reconciliation"
import type {
  AiRelationProvenance,
  AiRelationSuggestion,
} from "@/features/ontology/server/services/ai-relation-reconciliation"

export interface AdoptClassReconciliationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ontologyId: string
  cls: OntologyClassWithAttributes
  allClasses: OntologyClassWithAttributes[]
  relations: OntologyRelation[]
  standardTerm: TermAlignmentCandidate | null
  onSuccess?: () => void
}

export interface ConnectedRelationItem {
  relation: OntologyRelation
  direction: "outgoing" | "incoming"
  otherClassName: string
}

export interface RelationRowProps {
  item: ConnectedRelationItem
  currentClassName: string
  decision: RelationReconciliationDecision
  onChangeDecision: (decision: RelationReconciliationDecision) => void
  aiSuggestion?: AiRelationSuggestion
  onApplyAiSuggestion?: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export type { AiRelationProvenance }
