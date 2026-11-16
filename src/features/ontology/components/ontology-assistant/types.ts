import type {
  ApplyProposalResult,
  ProposedChangePlan,
  StagedOperationPreview,
} from "@/features/ontology/server/assistant-tools/types"

export type { ApplyProposalResult, ProposedChangePlan, StagedOperationPreview }

export interface InspectedToolRecord {
  tool: string
  args: Record<string, unknown>
  summary: string
}

export interface AssistantTurnResponse {
  reply: string
  inspectedTools: InspectedToolRecord[]
  proposal: ProposedChangePlan | null
  executionTrace?: {
    provider: string
    model: string
  }
}

export type ProposalStatus = "pending" | "applied" | "discarded"

export interface OntologyAssistantMessage {
  id: string
  role: "user" | "assistant"
  content: string
  inspectedTools?: InspectedToolRecord[]
  proposal?: ProposedChangePlan | null
  proposalStatus?: ProposalStatus
  appliedCount?: number
  applyError?: string | null
  createdAt: string
}
