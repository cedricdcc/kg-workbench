import { z } from "zod"
import { getLlmClient } from "@/server/llm"

export type ConnectedRelationContext = {
  id: string
  name: string
  domainClassName: string
  rangeClassName: string
  direction: "incoming" | "outgoing"
}

export type AiRelationSuggestion = {
  relationId: string
  suggestedAction: "keep" | "remap" | "delete"
  suggestedName?: string
  rationale: string
}

export type ModelAttemptLog = {
  model: string
  status: "succeeded" | "failed"
  statusCode?: number
  error?: string
  timestamp: string
}

export type AiRelationProvenance = {
  successfulModel: string
  attempts: ModelAttemptLog[]
}

export type SuggestionResult = {
  suggestions: AiRelationSuggestion[]
  provenance: AiRelationProvenance
}

export const AiRelationSuggestionSchema = z.object({
  relationId: z.string(),
  suggestedAction: z.enum(["keep", "remap", "delete"]),
  suggestedName: z.string().optional(),
  rationale: z.string(),
})

export const AiRelationSuggestionsListSchema = z.array(
  AiRelationSuggestionSchema
)

export function parseAiRelationSuggestions(
  rawText: string
): AiRelationSuggestion[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  const data = JSON.parse(cleaned)
  if (!Array.isArray(data)) {
    throw new Error("AI response was not a JSON array")
  }

  return data.map((item: unknown) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<
      string,
      unknown
    >
    const actionRaw = String(obj.suggestedAction || "")
    const suggestedAction: "keep" | "remap" | "delete" =
      actionRaw === "remap" || actionRaw === "delete" ? actionRaw : "keep"

    return {
      relationId: String(obj.relationId || ""),
      suggestedAction,
      suggestedName: obj.suggestedName ? String(obj.suggestedName) : undefined,
      rationale: String(obj.rationale || ""),
    }
  })
}

export async function suggestRelationRemappings(input: {
  ontologyId: string
  oldClassName: string
  standardTermCurie: string
  standardTermDescription?: string
  relations: ConnectedRelationContext[]
  apiKey?: string
  model?: string
  candidateModels?: string[]
}): Promise<SuggestionResult> {
  const chosenModel = input.model?.trim() || "gemini-3.8-flash"

  if (input.relations.length === 0) {
    return {
      suggestions: [],
      provenance: {
        successfulModel: chosenModel,
        attempts: [],
      },
    }
  }

  const systemInstruction = `You are a knowledge graph and ontology engineering expert.
An existing concept "${input.oldClassName}" is being reconciled and adopted to standard reference term "${input.standardTermCurie}"${input.standardTermDescription ? ` (${input.standardTermDescription})` : ""}.
Analyze each connected relation below and decide:
- "keep": The relation is domain-specific or custom, valid to keep as-is.
- "remap": The relation corresponds to a standard property from the reference vocabulary (provide suggestedName as standard CURIE, e.g., "sosa:observedProperty" or "skos:broader").
- "delete": The relation is redundant or semantically invalid after adopting the standard class.

Provide a brief 1-sentence rationale for each.
You must output a JSON array of objects with the exact schema:
[
  {
    "relationId": "uuid",
    "suggestedAction": "keep" | "remap" | "delete",
    "suggestedName": "optional standard CURIE string if remapped",
    "rationale": "short explanation"
  }
]`

  const userPrompt = `Connected relations for "${input.oldClassName}":
${JSON.stringify(input.relations, null, 2)}`

  const client = getLlmClient()
  const result = await client.generateStructured<AiRelationSuggestion[]>(
    {
      systemPrompt: systemInstruction,
      userPrompt,
    },
    {
      provider: "gemini",
      apiKey: input.apiKey,
      model: input.model,
      candidateModels: input.candidateModels,
      schema: AiRelationSuggestionsListSchema,
      schemaName: "AiRelationSuggestionsList",
    }
  )

  const attempts: ModelAttemptLog[] = result.trace.attempts.map((att) => ({
    model: att.model,
    status: att.status === 200 ? "succeeded" : "failed",
    statusCode: typeof att.status === "number" ? att.status : undefined,
    error: att.error,
    timestamp: new Date().toISOString(),
  }))

  return {
    suggestions: result.data,
    provenance: {
      successfulModel: result.trace.model,
      attempts,
    },
  }
}
