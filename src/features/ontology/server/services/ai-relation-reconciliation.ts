import { listGeminiModels } from "./ai-ontology-generator/gemini-provider"

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

export function parseAiRelationSuggestions(rawText: string): AiRelationSuggestion[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  const data = JSON.parse(cleaned)
  if (!Array.isArray(data)) {
    throw new Error("AI response was not a JSON array")
  }

  return data.map((item: unknown) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>
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

const DEFAULT_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-3.8-flash",
]

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
  const chosenModel = input.model?.trim() || "gemini-2.5-flash"

  if (input.relations.length === 0) {
    return {
      suggestions: [],
      provenance: {
        successfulModel: chosenModel,
        attempts: [],
      },
    }
  }

  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure GEMINI_API_KEY in your environment or settings."
    )
  }

  // Determine candidate models
  let candidatePool = input.candidateModels
  if (!candidatePool || candidatePool.length === 0) {
    try {
      const liveModels = await listGeminiModels(apiKey)
      if (liveModels.length > 0) {
        candidatePool = liveModels.map((m) => m.id)
      }
    } catch {
      // Offline or network error listing models; use built-in fallbacks
    }
  }

  if (!candidatePool || candidatePool.length === 0) {
    candidatePool = DEFAULT_FALLBACK_MODELS
  }

  // Ensure requested model is tried first
  const primaryModel = chosenModel.replace(/^models\//, "")
  const modelsQueue = [
    primaryModel,
    ...candidatePool
      .map((m) => m.replace(/^models\//, ""))
      .filter((m) => m !== primaryModel),
  ]

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

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  }

  const attempts: ModelAttemptLog[] = []
  let lastError: Error | null = null

  for (const currentModel of modelsQueue) {
    let cleanModel = currentModel
    if (cleanModel === "gemini-2.0-flash") {
      cleanModel = "gemini-3.8-flash"
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        attempts.push({
          model: currentModel,
          status: "failed",
          statusCode: response.status,
          error: errorText || response.statusText,
          timestamp: new Date().toISOString(),
        })
        lastError = new Error(
          `Gemini API error (${response.status}): ${errorText || response.statusText}`
        )
        // Fall back to next model
        continue
      }

      const result = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>
          }
        }>
      }

      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        attempts.push({
          model: currentModel,
          status: "failed",
          error: "Empty content returned",
          timestamp: new Date().toISOString(),
        })
        lastError = new Error("Empty content returned from Gemini")
        continue
      }

      const suggestions = parseAiRelationSuggestions(rawText)
      attempts.push({
        model: currentModel,
        status: "succeeded",
        timestamp: new Date().toISOString(),
      })

      return {
        suggestions,
        provenance: {
          successfulModel: currentModel,
          attempts,
        },
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      attempts.push({
        model: currentModel,
        status: "failed",
        error: errorMsg,
        timestamp: new Date().toISOString(),
      })
      lastError = err instanceof Error ? err : new Error(errorMsg)
    }
  }

  throw new Error(
    `All Gemini models failed (${attempts
      .map((a) => `${a.model}: ${a.statusCode || a.error}`)
      .join(", ")}): ${lastError?.message || "Unknown error"}`
  )
}
