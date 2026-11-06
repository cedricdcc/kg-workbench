import type { SupportedLlmProvider, LlmModelMetadata } from "./types"

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"

export const DEFAULT_GEMINI_CANDIDATE_MODELS: readonly string[] = [
  "gemini-3.8-flash",
  "gemini-3.1-pro-preview",
]

export const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3.8-flash",
  "gemini-2.0-flash": "gemini-3.8-flash",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
}

export const KNOWN_MODELS: readonly LlmModelMetadata[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "gemini",
    supportsStructured: true,
    isDefault: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    supportsStructured: true,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    supportsStructured: true,
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    supportsStructured: true,
  },
]

/**
 * Normalizes a model identifier for a given LLM provider.
 * Strips leading 'models/' prefix and applies provider-specific alias mappings.
 */
export function normalizeModelName(
  provider: SupportedLlmProvider,
  model?: string
): string {
  if (provider === "gemini") {
    if (!model || model.trim() === "") {
      return DEFAULT_GEMINI_MODEL
    }
    const stripped = model.replace(/^models\//, "").trim()
    return GEMINI_MODEL_ALIASES[stripped] ?? stripped
  }

  if (!model) {
    return ""
  }

  return model.replace(/^models\//, "").trim()
}

/**
 * Builds a prioritized, deduplicated queue of candidate models for fallback execution.
 */
export function getCandidateModels(
  provider: SupportedLlmProvider,
  primaryModel?: string,
  customCandidates?: string[]
): string[] {
  if (provider === "gemini") {
    const primary = normalizeModelName(provider, primaryModel)
    const baseCandidates =
      customCandidates && customCandidates.length > 0
        ? customCandidates
        : DEFAULT_GEMINI_CANDIDATE_MODELS

    const normalizedCandidates = baseCandidates.map((m) =>
      normalizeModelName(provider, m)
    )

    const fullQueue = [primary, ...normalizedCandidates].filter(Boolean)
    return Array.from(new Set(fullQueue))
  }

  const normalizedPrimary = primaryModel
    ? normalizeModelName(provider, primaryModel)
    : ""
  const normalizedCandidates = (customCandidates ?? [])
    .map((m) => normalizeModelName(provider, m))
    .filter(Boolean)

  const queue = [normalizedPrimary, ...normalizedCandidates].filter(Boolean)
  return Array.from(new Set(queue))
}
