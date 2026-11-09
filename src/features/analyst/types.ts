export interface AnalystConversation {
  id: string
  ontologyId: string
  groupKey: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AnalystReasoningStep {
  step: string
  detail: string
}

export interface AnalystSubgraphNode {
  id: string
  label: string
  kind: string
  metadata?: Record<string, unknown>
}

export interface AnalystSubgraphEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface AnalystSubgraph {
  nodes: AnalystSubgraphNode[]
  edges: AnalystSubgraphEdge[]
}

export interface AnalystCitation {
  sourceType: "document" | "table"
  sourceId: string
  sourceName: string
  paragraphIndex?: number
  pageFrom?: number
  pageTo?: number
  quoteText?: string
  tableRowKey?: string
}

export interface AnalystMessage {
  id: string
  conversationId: string
  sender: "user" | "assistant"
  content: string
  reasoningTrace?: AnalystReasoningStep[]
  subgraph?: AnalystSubgraph
  citations?: AnalystCitation[]
  createdAt: string
}

export type ContradictionConflictType =
  "value_mismatch" | "temporal_drift" | "negation"

export type ContradictionStatus = "open" | "resolved" | "dismissed"

export interface KnowledgeContradiction {
  id: string
  ontologyId: string
  groupKey: string
  entityId: string
  entityLabel: string
  relationName: string
  conflictType: ContradictionConflictType
  factA: Record<string, unknown>
  factB: Record<string, unknown>
  explanation: string
  status: ContradictionStatus
  resolutionAction?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateConversationInput {
  ontologyId: string
  title?: string
}

export interface SendQueryInput {
  conversationId: string
  ontologyId: string
  query: string
}

export interface SendQueryResult {
  userMessage: AnalystMessage
  jobId: string
  eventId: string
}

export interface ResolveContradictionInput {
  contradictionId: string
  status: "resolved" | "dismissed"
  actionNotes?: string
}

export interface RunDriftAnalysisResult {
  success: boolean
  eventId?: string
  jobId?: string
}
