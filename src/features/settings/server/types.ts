export type SupportedProvider =
  "gemini" | "vllm" | "bioportal" | "agroportal" | "ecoportal" | string

export interface ProviderConfigStatus {
  provider: SupportedProvider
  displayName: string
  isConfigured: boolean
  keyHint?: string
  updatedAt?: string
  hasEnvFallback: boolean
  endpoint?: string
  baseUrl?: string
}

export function validateApiKeyInput(
  key: unknown,
  provider?: SupportedProvider
): {
  valid: boolean
  error?: string
} {
  if (typeof key !== "string") {
    return { valid: false, error: "API key must be a string." }
  }

  const trimmed = key.trim()
  if (!trimmed) {
    return { valid: false, error: "API key or endpoint cannot be empty." }
  }

  if (provider === "vllm") {
    if (trimmed.length < 1) {
      return { valid: false, error: "Endpoint or API key cannot be empty." }
    }
    return { valid: true }
  }

  if (trimmed.length < 10) {
    return {
      valid: false,
      error: "API key is too short. Please provide a valid key.",
    }
  }

  return { valid: true }
}
