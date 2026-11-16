import type { z } from "zod"
import type { DbClient } from "../linkml/document-store"
import type { DbTransaction } from "../linkml/symbol-cascade"

/**
 * Execution context passed to every shared ontology assistant/MCP tool.
 */
export interface OntologyToolContext {
  groupKey: string
  db?: DbClient
  tx?: DbTransaction
}

export type OntologyToolMode = "read" | "write"

export interface OntologyToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  name: string
  description: string
  mode: OntologyToolMode
  inputSchema: TInput
  execute: (
    ctx: OntologyToolContext,
    input: z.infer<TInput>
  ) => Promise<TOutput>
}

export interface ProposedOperation {
  tool: string
  args: Record<string, unknown>
}

export type StagedOperationKind =
  "create" | "update" | "rename" | "delete" | "cq" | "dependency"

export interface StagedOperationPreview {
  index: number
  tool: string
  kind: StagedOperationKind
  summary: string
  isDestructive: boolean
  blastRadiusWarning?: string
  args: Record<string, unknown>
}

export interface ProposedChangePlan {
  id: string
  ontologyId: string
  operations: StagedOperationPreview[]
  hasDestructiveChanges: boolean
  validationErrors: Array<{
    index: number
    tool: string
    error: string
  }>
}

export type ApplyProposalResult =
  | {
      ok: true
      appliedCount: number
      results: Array<{
        index: number
        tool: string
        summary: string
        result: unknown
      }>
    }
  | {
      ok: false
      failedStepIndex: number
      failedTool: string
      error: string
      rolledBack: true
    }
