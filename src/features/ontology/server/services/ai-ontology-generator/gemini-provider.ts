import {
  GeneratedOntologyDraftSchema,
  type GeneratedOntologyDraft,
} from "@/features/ontology/schemas/ai-generation"
import { getLlmClient, getCandidateModels } from "@/server/llm"
import { getEffectiveApiKey } from "@/server/api-keys"

export const GEMINI_RESPONSE_SCHEMA = {
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

export const DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]

export async function requestGeminiDraft(
  prompt: { systemPrompt: string; userPrompt: string },
  options?: { apiKey?: string; model?: string; candidateModels?: string[] }
): Promise<GeneratedOntologyDraft> {
  const client = getLlmClient()
  try {
    const result = await client.generateStructured<GeneratedOntologyDraft>(
      {
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      },
      {
        provider: "gemini",
        apiKey: options?.apiKey,
        model: options?.model,
        candidateModels: options?.candidateModels,
        schema: GeneratedOntologyDraftSchema,
        schemaName: "GeneratedOntologyDraft",
        jsonSchema: GEMINI_RESPONSE_SCHEMA,
      }
    )
    return result.data
  } catch (err: unknown) {
    const attemptedModels =
      options?.candidateModels && options.candidateModels.length > 0
        ? options.candidateModels
        : getCandidateModels("gemini", options?.model)
    const attempted = attemptedModels.join(", ")
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Gemini generation failed across all attempted models (${attempted}). Last error: ${message}`
    )
  }
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
