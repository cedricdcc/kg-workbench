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
          triples: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                subjectClassName: { type: "STRING" },
                predicateRelationName: { type: "STRING" },
                objectClassName: { type: "STRING" },
              },
              required: [
                "subjectClassName",
                "predicateRelationName",
                "objectClassName",
              ],
            },
          },
        },
        required: ["cqId"],
      },
    },
  },
  required: ["modules", "classes", "relations", "cqMappings"],
}

import { getEffectiveApiKey } from "@/server/api-keys"

export const DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-3.8-flash",
]

export async function requestGeminiDraft(
  prompt: { systemPrompt: string; userPrompt: string },
  options?: { apiKey?: string; model?: string; candidateModels?: string[] }
): Promise<GeneratedOntologyDraft> {
  const apiKey = options?.apiKey?.trim() || (await getEffectiveApiKey("gemini"))
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please configure a key in Settings or set GEMINI_API_KEY in your environment."
    )
  }

  const requestedModel = options?.model?.trim() || "gemini-2.5-flash"
  const primaryModel =
    requestedModel === "gemini-2.0-flash" ? "gemini-2.5-flash" : requestedModel
  const primaryClean = primaryModel.replace(/^models\//, "")

  let candidatePool = options?.candidateModels
  if (!candidatePool || candidatePool.length === 0) {
    try {
      const liveModels = await listGeminiModels(apiKey)
      if (liveModels.length > 0) {
        candidatePool = liveModels.map((m) => m.id)
      }
    } catch {
      // Offline, network issue or restricted key, fall back to default list
    }
  }

  if (!candidatePool || candidatePool.length === 0) {
    candidatePool = DEFAULT_GEMINI_FALLBACK_MODELS
  }

  // Ensure primary model is first, followed by others without duplicates
  const modelsQueue = [
    primaryClean,
    ...candidatePool
      .map((m) =>
        (m === "gemini-2.0-flash" ? "gemini-2.5-flash" : m).replace(
          /^models\//,
          ""
        )
      )
      .filter((m) => m !== primaryClean),
  ]

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

  let lastError: Error | null = null

  for (let i = 0; i < modelsQueue.length; i++) {
    const currentModel = modelsQueue[i]!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }).catch((err) => {
        throw new Error(
          `Failed to reach Google Gemini API at ${url}: ${err.message}`
        )
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        const isFallbackable =
          response.status === 503 ||
          response.status === 429 ||
          response.status === 404 ||
          response.status >= 500

        if (isFallbackable && i < modelsQueue.length - 1) {
          console.warn(
            `[Gemini] Model "${currentModel}" returned status ${response.status} (${errorText || response.statusText}). Retrying with next fallback model "${modelsQueue[i + 1]}"...`
          )
          lastError = new Error(
            `Gemini API error (${response.status}) on model ${currentModel}: ${errorText || response.statusText}`
          )
          continue
        }

        if (response.status === 429) {
          throw new Error(
            "Gemini API rate limit exceeded. Please try again shortly."
          )
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
        if (i < modelsQueue.length - 1) {
          console.warn(
            `[Gemini] Model "${currentModel}" returned empty content. Retrying with next fallback model "${modelsQueue[i + 1]}"...`
          )
          lastError = new Error(`Empty content returned from ${currentModel}`)
          continue
        }
        throw new Error("Gemini returned an empty response.")
      }

      const sanitized = sanitizeAiJsonResponse(textOutput)
      const parsedJson = JSON.parse(sanitized)
      return GeneratedOntologyDraftSchema.parse(parsedJson)
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err)
      lastError = err instanceof Error ? err : new Error(errMessage)

      if (
        i < modelsQueue.length - 1 &&
        (errMessage.includes("503") ||
          errMessage.includes("high demand") ||
          errMessage.includes("UNAVAILABLE") ||
          errMessage.includes("429") ||
          errMessage.includes("rate limit") ||
          errMessage.includes("Failed to reach"))
      ) {
        console.warn(
          `[Gemini] Model "${currentModel}" failed with error: "${errMessage}". Retrying with next fallback model "${modelsQueue[i + 1]}"...`
        )
        continue
      }

      if (i === modelsQueue.length - 1) {
        throw new Error(
          `Gemini generation failed across all attempted models (${modelsQueue.join(", ")}). Last error: ${errMessage}`
        )
      }
      throw err
    }
  }

  throw (
    lastError ||
    new Error(
      `Gemini generation failed across all attempted models (${modelsQueue.join(", ")})`
    )
  )
}

export type GeminiModelInfo = {
  id: string
  displayName: string
  description?: string
}

export async function listGeminiModels(
  apiKey?: string
): Promise<GeminiModelInfo[]> {
  const key = apiKey?.trim() || (await getEffectiveApiKey("gemini"))
  if (!key) {
    throw new Error(
      "Missing Gemini API key. Please configure a key in Settings or set GEMINI_API_KEY in your environment."
    )
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  const response = await fetch(url).catch((err) => {
    throw new Error(
      `Failed to reach Google Gemini API at ${url}: ${err.message}`
    )
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
