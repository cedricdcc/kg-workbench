import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getEffectiveApiKey,
  getEffectiveEndpoint,
} from "../src/server/api-keys"
import { testUserApiKey } from "../src/features/settings/server/actions/test-api-key"
import { getUserApiKeysStatus } from "../src/features/settings/server/queries/get-api-keys-status"
import { validateApiKeyInput } from "../src/features/settings/server/types"

test("getEffectiveEndpoint for vllm returns VLLM_BASE_URL env var or default http://localhost:8000/v1", async () => {
  const orig = process.env.VLLM_BASE_URL
  try {
    delete process.env.VLLM_BASE_URL
    const defaultEndpoint = await getEffectiveEndpoint("vllm")
    assert.equal(defaultEndpoint, "http://localhost:8000/v1")

    process.env.VLLM_BASE_URL = "http://my-vllm-host:8000/v1"
    const customEndpoint = await getEffectiveEndpoint("vllm")
    assert.equal(customEndpoint, "http://my-vllm-host:8000/v1")
  } finally {
    if (orig === undefined) {
      delete process.env.VLLM_BASE_URL
    } else {
      process.env.VLLM_BASE_URL = orig
    }
  }
})

test("getEffectiveEndpoint returns null for non-endpoint providers", async () => {
  assert.equal(await getEffectiveEndpoint("gemini"), null)
  assert.equal(await getEffectiveEndpoint("bioportal"), null)
})

test("getEffectiveApiKey for vllm falls back to VLLM_API_KEY env var", async () => {
  const orig = process.env.VLLM_API_KEY
  try {
    delete process.env.VLLM_API_KEY
    assert.equal(await getEffectiveApiKey("vllm"), null)

    process.env.VLLM_API_KEY = "vllm-token-123"
    assert.equal(await getEffectiveApiKey("vllm"), "vllm-token-123")
  } finally {
    if (orig === undefined) {
      delete process.env.VLLM_API_KEY
    } else {
      process.env.VLLM_API_KEY = orig
    }
  }
})

test("validateApiKeyInput allows URLs and short tokens for vLLM, but enforces length for other providers", () => {
  // vLLM provider validation
  assert.equal(
    validateApiKeyInput("http://localhost:8000/v1", "vllm").valid,
    true
  )
  assert.equal(
    validateApiKeyInput("https://ai.example.com", "vllm").valid,
    true
  )
  assert.equal(validateApiKeyInput("token123", "vllm").valid, true)
  assert.equal(validateApiKeyInput("", "vllm").valid, false)
  assert.equal(validateApiKeyInput("   ", "vllm").valid, false)

  // Default / other providers
  assert.equal(validateApiKeyInput("short", "gemini").valid, false)
  assert.equal(
    validateApiKeyInput("valid-length-api-key", "gemini").valid,
    true
  )
})

test("testUserApiKey for vllm pings /models with candidate URL and measures latency", async () => {
  const origFetch = globalThis.fetch
  try {
    let calledUrl = ""
    let authHeader: string | undefined

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calledUrl = String(input)
      authHeader = (init?.headers as Record<string, string>)?.["Authorization"]
      return new Response(JSON.stringify({ data: [{ id: "qwen-2.5-7b" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const result = await testUserApiKey("vllm", "http://localhost:8000/v1")
    assert.equal(result.ok, true)
    assert.ok(result.latencyMs !== undefined)
    assert.equal(calledUrl, "http://localhost:8000/v1/models")
    assert.equal(authHeader, undefined)
  } finally {
    globalThis.fetch = origFetch
  }
})

test("testUserApiKey for vllm supports candidateKey with JSON containing baseUrl and apiKey", async () => {
  const origFetch = globalThis.fetch
  try {
    let calledUrl = ""
    let authHeader: string | undefined

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calledUrl = String(input)
      authHeader = (init?.headers as Record<string, string>)?.["Authorization"]
      return new Response(JSON.stringify({ data: [{ id: "llama-3-8b" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const jsonConfig = JSON.stringify({
      baseUrl: "http://127.0.0.1:9000/v1",
      apiKey: "custom-bearer-token",
    })
    const result = await testUserApiKey("vllm", jsonConfig)
    assert.equal(result.ok, true)
    assert.equal(calledUrl, "http://127.0.0.1:9000/v1/models")
    assert.equal(authHeader, "Bearer custom-bearer-token")
  } finally {
    globalThis.fetch = origFetch
  }
})

test("testUserApiKey for vllm handles non-200 responses and connection failures", async () => {
  const origFetch = globalThis.fetch
  try {
    // 503 response
    globalThis.fetch = (async () => {
      return new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      })
    }) as unknown as typeof fetch

    const res503 = await testUserApiKey("vllm", "http://localhost:8000/v1")
    assert.equal(res503.ok, false)
    assert.ok(res503.error?.includes("503"))

    // Connection refused / network failure
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8000")
    }) as unknown as typeof fetch

    const resConn = await testUserApiKey("vllm", "http://localhost:8000/v1")
    assert.equal(resConn.ok, false)
    assert.ok(resConn.error?.includes("ECONNREFUSED"))
  } finally {
    globalThis.fetch = origFetch
  }
})

test("getUserApiKeysStatus includes vLLM configuration status and env fallback", async () => {
  const orig = process.env.VLLM_BASE_URL
  try {
    delete process.env.VLLM_BASE_URL
    const statusesWithoutEnv = await getUserApiKeysStatus()
    const vllmWithoutEnv = statusesWithoutEnv.find((s) => s.provider === "vllm")
    assert.ok(vllmWithoutEnv)
    assert.equal(vllmWithoutEnv.displayName, "Local vLLM (OpenAI-compatible)")
    assert.equal(vllmWithoutEnv.hasEnvFallback, false)

    process.env.VLLM_BASE_URL = "http://remote-vllm:8000/v1"
    const statusesWithEnv = await getUserApiKeysStatus()
    const vllmWithEnv = statusesWithEnv.find((s) => s.provider === "vllm")
    assert.ok(vllmWithEnv)
    assert.equal(vllmWithEnv.hasEnvFallback, true)
  } finally {
    if (orig === undefined) {
      delete process.env.VLLM_BASE_URL
    } else {
      process.env.VLLM_BASE_URL = orig
    }
  }
})
