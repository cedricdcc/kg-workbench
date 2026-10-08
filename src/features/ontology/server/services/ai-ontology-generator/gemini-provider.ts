import {
  GeneratedOntologyDraftSchema,
  sanitizeAiJsonResponse,
  type GeneratedOntologyDraft,
} from "@/features/ontology/schemas/ai-generation"

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    modules: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["name"],
      },
    },
    classes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          moduleName: { type: "STRING" },
          attributes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                dataType: {
                  type: "STRING",
                  enum: [
                    "xsd:string",
                    "xsd:integer",
                    "xsd:decimal",
                    "xsd:boolean",
                    "xsd:date",
                  ],
                },
                description: { type: "STRING" },
              },
              required: ["name"],
            },
          },
        },
        required: ["name", "moduleName"],
      },
    },
    relations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          domainClassName: { type: "STRING" },
          rangeClassName: { type: "STRING" },
        },
        required: ["name", "domainClassName", "rangeClassName"],
      },
    },
    cqMappings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          cqId: { type: "STRING" },
          subjectClassName: { type: "STRING" },
          predicateRelationName: { type: "STRING" },
          objectClassName: { type: "STRING" },
          moduleNames: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: [
          "cqId",
          "subjectClassName",
          "predicateRelationName",
          "objectClassName",
        ],
      },
    },
  },
  required: ["modules", "classes", "relations", "cqMappings"],
}

export async function requestGeminiDraft(
  prompt: { systemPrompt: string; userPrompt: string },
  options?: { apiKey?: string; model?: string }
): Promise<GeneratedOntologyDraft> {
  const apiKey = options?.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please set GEMINI_API_KEY in your environment or provide an API key in the generation settings."
    )
  }

  let model = options?.model?.trim() || "gemini-3.8-flash"
  if (model === "gemini-2.0-flash") {
    model = "gemini-3.8-flash"
  }
  const cleanModel = model.replace(/^models\//, "")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`

  const requestBody = {
    systemInstruction: {
      parts: [{ text: prompt.systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt.userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).catch((err) => {
    throw new Error(`Failed to reach Google Gemini API at ${url}: ${err.message}`)
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
    throw new Error(
      `Gemini API error (${response.status}): ${errorText || response.statusText}`
    )
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }

  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!textOutput) {
    throw new Error("Gemini returned an empty response.")
  }

  const sanitized = sanitizeAiJsonResponse(textOutput)
  const parsedJson = JSON.parse(sanitized)
  return GeneratedOntologyDraftSchema.parse(parsedJson)
}

export type GeminiModelInfo = {
  id: string
  displayName: string
  description?: string
}

export async function listGeminiModels(
  apiKey?: string
): Promise<GeminiModelInfo[]> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "Missing Gemini API key. Please enter an API key or configure GEMINI_API_KEY in your environment."
    )
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  const response = await fetch(url).catch((err) => {
    throw new Error(`Failed to reach Google Gemini API at ${url}: ${err.message}`)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    if (response.status === 400 || response.status === 403) {
      throw new Error("Invalid Gemini API key. Please check your credentials.")
    }
    throw new Error(
      `Gemini API error (${response.status}): ${errorText || response.statusText}`
    )
  }

  const data = (await response.json()) as {
    models?: Array<{
      name: string
      displayName?: string
      description?: string
      supportedGenerationMethods?: string[]
    }>
  }

  if (!data.models || !Array.isArray(data.models)) {
    return []
  }

  return data.models
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes("generateContent") &&
        m.name.includes("gemini")
    )
    .map((m) => {
      const id = m.name.replace(/^models\//, "")
      return {
        id,
        displayName: m.displayName || id,
        description: m.description,
      }
    })
    .sort((a, b) => {
      // Prioritize flash models
      const aFlash = a.id.includes("flash") ? -1 : 1
      const bFlash = b.id.includes("flash") ? -1 : 1
      if (aFlash !== bFlash) return aFlash - bFlash
      return a.id.localeCompare(b.id)
    })
}
