export type SupportedProvider =
  | "gemini"
  | "bioportal"
  | "agroportal"
  | "ecoportal"
  | string

export interface ProviderConfigStatus {
  provider: SupportedProvider
  displayName: string
  isConfigured: boolean
  keyHint?: string
  updatedAt?: string
  hasEnvFallback: boolean
}

export function validateApiKeyInput(key: unknown): {
  valid: boolean
  error?: string
} {
  if (typeof key !== "string") {
    return { valid: false, error: "API key must be a string." }
  }

  const trimmed = key.trim()
  if (!trimmed) {
    return { valid: false, error: "API key cannot be empty." }
  }

  if (trimmed.length < 10) {
    return {
      valid: false,
      error: "API key is too short. Please provide a valid key.",
    }
  }

  return { valid: true }
}
