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

export async function suggestRelationRemappings(input: {
  ontologyId: string
  oldClassName: string
  standardTermCurie: string
  standardTermDescription?: string
  relations: ConnectedRelationContext[]
  apiKey?: string
  model?: string
}): Promise<AiRelationSuggestion[]> {
  if (input.relations.length === 0) {
    return []
  }

  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure GEMINI_API_KEY in your environment or settings."
    )
  }

  let model = input.model?.trim() || "gemini-3.8-flash"
  if (model === "gemini-2.0-flash") {
    model = "gemini-3.8-flash"
  }
  const cleanModel = model.replace(/^models\//, "")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`

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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).catch((err) => {
    throw new Error(`Failed to reach Google Gemini API: ${err.message}`)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    if (response.status === 429) {
      throw new Error("Gemini API rate limit exceeded. Please try again shortly.")
    }
    if (response.status === 400 || response.status === 403) {
      throw new Error(
        `Gemini API request failed (${response.status}): Please check that your API key is valid.`
      )
    }
    throw new Error(`Gemini API error (${response.status}): ${errorText || response.statusText}`)
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
    throw new Error("Gemini returned an empty response.")
  }

  return parseAiRelationSuggestions(rawText)
}
