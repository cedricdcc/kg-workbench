import "server-only"

import { z } from "zod"
import {
  assertOntologyDocumentAccess,
  runWithGroupKey,
} from "@/server/group-access"
import { getLlmClient, type LlmClient } from "@/server/llm/client"
import type { SupportedLlmProvider } from "@/server/llm/types"
import { previewProposedOperations } from "../assistant-tools/executor"
import { READ_TOOLS } from "../assistant-tools/read-tools"
import type {
  OntologyToolContext,
  OntologyToolDefinition,
  ProposedChangePlan,
  ProposedOperation,
} from "../assistant-tools/types"
import {
  WRITE_TOOLS,
  type WriteToolDefinition,
} from "../assistant-tools/write-tools"

const MAX_READ_ITERATIONS = 4
const MAX_OBSERVATION_CHARS = 12_000

export interface AssistantChatMessage {
  role: "user" | "assistant"
  content: string
}

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

export interface RunOntologyAssistantTurnInput {
  ontologyId: string
  groupKey: string
  messages: AssistantChatMessage[]
  provider?: SupportedLlmProvider
  model?: string
  llmClient?: LlmClient
}

export interface OntologyAssistantAgentDeps {
  assertOntologyDocumentAccess?: (ontologyId: string) => Promise<string>
  readTools?: Record<string, OntologyToolDefinition>
  writeTools?: Record<string, WriteToolDefinition>
  previewProposedOperations?: (
    ctx: OntologyToolContext,
    ontologyId: string,
    operations: ProposedOperation[]
  ) => Promise<ProposedChangePlan>
}

const assistantStepSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("call_read_tool"),
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    action: z.literal("final"),
    reply: z.string(),
    proposedOperations: z
      .array(
        z.object({
          tool: z.string().min(1),
          args: z.record(z.string(), z.unknown()).default({}),
        })
      )
      .default([]),
  }),
])

function safeSchemaSummary(schema: z.ZodTypeAny): string {
  try {
    const jsonSchema = {
      ...(z.toJSONSchema(schema) as Record<string, unknown>),
    }
    delete jsonSchema.$schema
    return JSON.stringify(jsonSchema)
  } catch {
    return "{}"
  }
}

function buildToolCatalogSection(
  readTools: Record<string, OntologyToolDefinition>,
  writeTools: Record<string, WriteToolDefinition>
): string {
  const readLines = Object.values(readTools).map(
    (tool) =>
      `- ${tool.name}: ${tool.description} | argsSchema=${safeSchemaSummary(tool.inputSchema)}`
  )
  const writeLines = Object.values(writeTools).map(
    (tool) =>
      `- ${tool.name} [${tool.kind}${tool.isDestructive ? ", destructive" : ""}]: ${tool.description} | argsSchema=${safeSchemaSummary(tool.inputSchema)}`
  )

  return [
    "### Available READ_TOOLS (can be invoked via action='call_read_tool')",
    ...readLines,
    "",
    "### Available WRITE_TOOLS (can ONLY be proposed via action='final' proposedOperations; never executed directly)",
    ...writeLines,
  ].join("\n")
}

function buildSystemPrompt(
  ontologyId: string,
  summaryJson: string,
  readTools: Record<string, OntologyToolDefinition>,
  writeTools: Record<string, WriteToolDefinition>
): string {
  return [
    "You are the in-app Ontology Assistant for kg-workbench.",
    "You help users inspect, analyze, and propose structured edits to the active LinkML ontology and its Competency Questions (CQs).",
    "CRITICAL RULES:",
    "1. You NEVER mutate the database directly. Any edits must be returned in `proposedOperations` under `action: 'final'` so the user can preview blast radius and click Apply.",
    "2. If you need to inspect classes, CQs, LinkML YAML, linter defects, reasoner results, or blast radius before answering or proposing edits, return `action: 'call_read_tool'` with a tool from READ_TOOLS.",
    "3. You have at most 4 read-tool calls per turn. Use them efficiently.",
    "4. For pure questions or explanations, return `action: 'final'` with `proposedOperations: []`.",
    "5. Always include valid arguments matching each tool's argsSchema. `ontologyId` is `" +
      ontologyId +
      "`.",
    "",
    "### Response JSON Contract",
    'Option A (inspect): { "action": "call_read_tool", "tool": "<read_tool_name>", "args": { ... } }',
    'Option B (respond): { "action": "final", "reply": "<concise markdown response>", "proposedOperations": [ { "tool": "<write_tool_name>", "args": { ... } } ] }',
    "",
    "### Active Ontology Summary",
    summaryJson,
    "",
    buildToolCatalogSection(readTools, writeTools),
  ].join("\n")
}

interface ToolObservation {
  step: number
  tool: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}

function formatConversationPrompt(
  messages: AssistantChatMessage[],
  observations: ToolObservation[],
  mustFinalize: boolean
): string {
  const historyLines = messages.map(
    (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
  )

  const sections: string[] = ["### Conversation", ...historyLines]

  if (observations.length > 0) {
    sections.push("", "### Read Tool Observations")
    for (const obs of observations) {
      const payload = obs.error
        ? `ERROR: ${obs.error}`
        : truncateJson(obs.result, MAX_OBSERVATION_CHARS)
      sections.push(
        `[Step ${obs.step}] ${obs.tool}(${JSON.stringify(obs.args)}) => ${payload}`
      )
    }
  }

  if (mustFinalize) {
    sections.push(
      "",
      "### Instruction",
      `Maximum read-tool iterations (${MAX_READ_ITERATIONS}) reached. You MUST now return action='final' with your reply and any proposedOperations.`
    )
  }

  return sections.join("\n")
}

function truncateJson(value: unknown, maxChars: number): string {
  const serialized = JSON.stringify(value) ?? "null"
  if (serialized.length <= maxChars) {
    return serialized
  }
  return `${serialized.slice(0, maxChars)}... [truncated ${serialized.length - maxChars} chars]`
}

function summarizeReadToolResult(toolName: string, result: unknown): string {
  if (result && typeof result === "object") {
    if ("error" in result && typeof result.error === "string") {
      return `${toolName} failed: ${result.error}`
    }
    if ("total" in result && typeof result.total === "number") {
      return `${toolName} returned ${result.total} item(s)`
    }
    if ("issues" in result && Array.isArray(result.issues)) {
      return `${toolName} found ${result.issues.length} issue(s)`
    }
    if ("classes" in result && Array.isArray(result.classes)) {
      return `${toolName} loaded ${result.classes.length} class(es)`
    }
  }
  return `${toolName} completed`
}

function normalizeReadArgs(
  ontologyId: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  if ("ontologyId" in args) {
    return args
  }
  return { ontologyId, ...args }
}

/**
 * Runs a single in-app Ontology Assistant turn using LlmClient.generateStructured
 * with a bounded read-tool inspection loop (max 4 iterations) and validated
 * ProposedChangePlan previewing without ever mutating database state.
 */
export async function runOntologyAssistantTurn(
  input: RunOntologyAssistantTurnInput,
  deps?: OntologyAssistantAgentDeps
): Promise<AssistantTurnResponse> {
  return runWithGroupKey(input.groupKey, async () => {
    const checkAccess =
      deps?.assertOntologyDocumentAccess ?? assertOntologyDocumentAccess
    await checkAccess(input.ontologyId)

    const readTools = (deps?.readTools ?? READ_TOOLS) as unknown as Record<
      string,
      OntologyToolDefinition
    >
    const writeTools = (deps?.writeTools ?? WRITE_TOOLS) as unknown as Record<
      string,
      WriteToolDefinition
    >
    const previewPlan =
      deps?.previewProposedOperations ??
      ((ctx, ontologyId, ops) =>
        previewProposedOperations(ctx, ontologyId, ops, { writeTools }))

    const ctx: OntologyToolContext = { groupKey: input.groupKey }

    let summaryPayload: unknown = { ontologyId: input.ontologyId }
    const summaryTool = readTools.get_ontology_summary
    if (summaryTool) {
      try {
        summaryPayload = await summaryTool.execute(ctx, {
          ontologyId: input.ontologyId,
        })
      } catch {
        summaryPayload = { ontologyId: input.ontologyId }
      }
    }

    const systemPrompt = buildSystemPrompt(
      input.ontologyId,
      truncateJson(summaryPayload, 8_000),
      readTools,
      writeTools
    )

    const llmClient = input.llmClient ?? getLlmClient()
    const inspectedTools: InspectedToolRecord[] = []
    const observations: ToolObservation[] = []
    let executionTrace: { provider: string; model: string } | undefined

    for (let iteration = 0; iteration <= MAX_READ_ITERATIONS; iteration++) {
      const mustFinalize = iteration === MAX_READ_ITERATIONS
      const userPrompt = formatConversationPrompt(
        input.messages,
        observations,
        mustFinalize
      )

      const { data: step, trace } = await llmClient.generateStructured(
        {
          systemPrompt,
          userPrompt,
        },
        {
          provider: input.provider,
          model: input.model,
          schema: assistantStepSchema,
          schemaName: "OntologyAssistantStep",
          temperature: 0.1,
        }
      )

      executionTrace = {
        provider: trace.provider,
        model: trace.model,
      }

      if (step.action === "final") {
        const proposal =
          step.proposedOperations.length > 0
            ? await previewPlan(ctx, input.ontologyId, step.proposedOperations)
            : null

        return {
          reply: step.reply,
          inspectedTools,
          proposal,
          executionTrace,
        }
      }

      if (mustFinalize) {
        break
      }

      const readTool = readTools[step.tool]
      if (!readTool || readTool.mode !== "read") {
        const errorMessage = `Tool "${step.tool}" is not an available read tool.`
        inspectedTools.push({
          tool: step.tool,
          args: step.args,
          summary: errorMessage,
        })
        observations.push({
          step: iteration + 1,
          tool: step.tool,
          args: step.args,
          error: errorMessage,
        })
        continue
      }

      try {
        const normalizedArgs = normalizeReadArgs(input.ontologyId, step.args)
        const result = await readTool.execute(ctx, normalizedArgs)
        inspectedTools.push({
          tool: step.tool,
          args: step.args,
          summary: summarizeReadToolResult(step.tool, result),
        })
        observations.push({
          step: iteration + 1,
          tool: step.tool,
          args: step.args,
          result,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        inspectedTools.push({
          tool: step.tool,
          args: step.args,
          summary: `${step.tool} failed: ${message}`,
        })
        observations.push({
          step: iteration + 1,
          tool: step.tool,
          args: step.args,
          error: message,
        })
      }
    }

    return {
      reply:
        "I reached the maximum number of inspection steps without finalizing a response. Please refine your request and try again.",
      inspectedTools,
      proposal: null,
      executionTrace,
    }
  })
}
