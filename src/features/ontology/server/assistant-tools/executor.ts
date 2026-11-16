import crypto from "node:crypto"
import type { z } from "zod"
import { getDb } from "@/server/database"
import { runWithGroupKey } from "@/server/group-access"
import type { DbClient } from "../linkml/document-store"
import type { DbTransaction } from "../linkml/symbol-cascade"
import type {
  ApplyProposalResult,
  OntologyToolContext,
  ProposedChangePlan,
  ProposedOperation,
  StagedOperationPreview,
} from "./types"
import { WRITE_TOOLS, type WriteToolDefinition } from "./write-tools"

export interface ExecutorDeps {
  writeTools?: Record<string, WriteToolDefinition>
  getDb?: () => DbClient
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
      return `${path}${issue.message}`
    })
    .join("; ")
}

function getWriteToolMap(
  deps?: ExecutorDeps
): Record<string, WriteToolDefinition> {
  return (deps?.writeTools ?? WRITE_TOOLS) as unknown as Record<
    string,
    WriteToolDefinition
  >
}

function normalizeOperationArgs(
  ontologyId: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  if ("ontologyId" in args) {
    return args
  }
  return { ontologyId, ...args }
}

/**
 * Validates proposed write operations, generates deterministic summaries and
 * blast-radius warnings, and returns a ProposedChangePlan without mutating DB state.
 */
export async function previewProposedOperations(
  ctx: OntologyToolContext,
  ontologyId: string,
  operations: ProposedOperation[],
  deps?: ExecutorDeps
): Promise<ProposedChangePlan> {
  const writeTools = getWriteToolMap(deps)
  const staged: StagedOperationPreview[] = []
  const validationErrors: ProposedChangePlan["validationErrors"] = []

  await runWithGroupKey(ctx.groupKey, async () => {
    for (let index = 0; index < operations.length; index++) {
      const op = operations[index]
      if (!op) continue

      const tool = writeTools[op.tool]
      if (!tool || tool.mode !== "write") {
        validationErrors.push({
          index,
          tool: op.tool,
          error: `Unknown write tool "${op.tool}".`,
        })
        continue
      }

      const rawArgs = normalizeOperationArgs(ontologyId, op.args ?? {})
      const parsed = tool.inputSchema.safeParse(rawArgs)
      if (!parsed.success) {
        validationErrors.push({
          index,
          tool: op.tool,
          error: formatZodError(parsed.error),
        })
        continue
      }

      const description = await tool.describeOperation(ctx, parsed.data)
      staged.push({
        index,
        tool: op.tool,
        kind: description.kind,
        summary: description.summary,
        isDestructive: description.isDestructive,
        ...(description.blastRadiusWarning
          ? { blastRadiusWarning: description.blastRadiusWarning }
          : {}),
        args: parsed.data as Record<string, unknown>,
      })
    }
  })

  return {
    id: crypto.randomUUID(),
    ontologyId,
    operations: staged,
    hasDestructiveChanges: staged.some((op) => op.isDestructive),
    validationErrors,
  }
}

/**
 * Validates and executes all proposed write operations inside a single PostgreSQL
 * transaction. Any failure rolls back the entire batch and reports the failing step.
 */
export async function applyProposedOperationsAtomically(
  ctx: OntologyToolContext,
  ontologyId: string,
  operations: ProposedOperation[],
  deps?: ExecutorDeps
): Promise<ApplyProposalResult> {
  const writeTools = getWriteToolMap(deps)

  const validatedSteps: Array<{
    index: number
    toolName: string
    tool: WriteToolDefinition
    parsedArgs: Record<string, unknown>
  }> = []

  for (let index = 0; index < operations.length; index++) {
    const op = operations[index]
    if (!op) continue

    const tool = writeTools[op.tool]
    if (!tool || tool.mode !== "write") {
      return {
        ok: false,
        failedStepIndex: index,
        failedTool: op.tool,
        error: `Unknown write tool "${op.tool}".`,
        rolledBack: true,
      }
    }

    const rawArgs = normalizeOperationArgs(ontologyId, op.args ?? {})
    const parsed = tool.inputSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return {
        ok: false,
        failedStepIndex: index,
        failedTool: op.tool,
        error: formatZodError(parsed.error),
        rolledBack: true,
      }
    }

    validatedSteps.push({
      index,
      toolName: op.tool,
      tool,
      parsedArgs: parsed.data as Record<string, unknown>,
    })
  }

  let currentStepIndex = 0
  let currentTool = ""

  const executeBatch = async (tx: DbTransaction) => {
    const txCtx: OntologyToolContext = {
      ...ctx,
      tx,
    }
    const results: Array<{
      index: number
      tool: string
      summary: string
      result: unknown
    }> = []

    for (const step of validatedSteps) {
      currentStepIndex = step.index
      currentTool = step.toolName

      const description = await step.tool.describeOperation(
        txCtx,
        step.parsedArgs
      )
      const result = await step.tool.execute(txCtx, step.parsedArgs)
      results.push({
        index: step.index,
        tool: step.toolName,
        summary: description.summary,
        result,
      })
    }

    return results
  }

  try {
    const results = await runWithGroupKey(ctx.groupKey, async () => {
      if (ctx.tx) {
        return executeBatch(ctx.tx)
      }

      const database = (ctx.db ??
        deps?.getDb?.() ??
        (getDb() as unknown as DbClient)) as DbClient

      if (typeof database.transaction === "function") {
        return database.transaction((tx) => executeBatch(tx))
      }

      return executeBatch(database)
    })

    return {
      ok: true,
      appliedCount: results.length,
      results,
    }
  } catch (err) {
    return {
      ok: false,
      failedStepIndex: currentStepIndex,
      failedTool: currentTool,
      error: err instanceof Error ? err.message : String(err),
      rolledBack: true,
    }
  }
}
