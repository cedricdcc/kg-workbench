import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import {
  callGeminiApi,
  discoverGeminiModels,
  _clearGeminiModelCache,
} from "../src/server/llm/providers/gemini-provider"
import {
  callOpenAiCompatibleApi,
  discoverOpenAiModels,
  _clearModelCache,
} from "../src/server/llm/providers/openai-compatible"

interface ErrorWithStatus extends Error {
  status?: number
}

const originalFetch = globalThis.fetch
const originalDateNow = Date.now

afterEach(() => {
  globalThis.fetch = originalFetch
  Date.now = originalDateNow
  _clearModelCache()
  _clearGeminiModelCache()
})

test("callGeminiApi throws error if apiKey is missing", async () => {
  await assert.rejects(
    () =>
      callGeminiApi({
        model: "gemini-3.8-flash",
        prompt: { userPrompt: "Hello" },
      }),
    /Missing Gemini API key/i
  )
})

test("callGeminiApi formats payload correctly with system prompt and json schema", async () => {
  let capturedUrl = ""
  let capturedOptions: RequestInit | undefined

  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedUrl = url.toString()
    capturedOptions = init
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"message":"hello world"}' }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const response = await callGeminiApi({
    model: "gemini-3.8-flash",
    prompt: {
      systemPrompt: "You are an assistant.",
      userPrompt: "Respond with JSON",
    },
    apiKey: "test-gemini-key",
    temperature: 0.2,
    maxTokens: 1024,
    responseFormat: "json",
    jsonSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  })

  assert.equal(
    capturedUrl,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test-gemini-key"
  )
  assert.equal(capturedOptions?.method, "POST")

  const body = JSON.parse(capturedOptions?.body as string)
  assert.deepEqual(body.systemInstruction, {
    parts: [{ text: "You are an assistant." }],
  })
  assert.deepEqual(body.contents, [
    { role: "user", parts: [{ text: "Respond with JSON" }] },
  ])
  assert.equal(body.generationConfig.temperature, 0.2)
  assert.equal(body.generationConfig.maxOutputTokens, 1024)
  assert.equal(body.generationConfig.responseMimeType, "application/json")
  assert.deepEqual(body.generationConfig.responseSchema, {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  })

  assert.equal(response.text, '{"message":"hello world"}')
  assert.ok(typeof response.durationMs === "number" && response.durationMs >= 0)
})

test("callGeminiApi formats payload correctly without system instruction or generationConfig", async () => {
  let capturedOptions: RequestInit | undefined

  globalThis.fetch = (async (
    _url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedOptions = init
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Plain response" }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const response = await callGeminiApi({
    model: "gemini-3.8-flash",
    prompt: { userPrompt: "Hello" },
    apiKey: "test-gemini-key",
  })

  const body = JSON.parse(capturedOptions?.body as string)
  assert.equal(body.systemInstruction, undefined)
  assert.equal(body.generationConfig, undefined)
  assert.equal(response.text, "Plain response")
})

test("callGeminiApi throws error with status on HTTP error", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 404,
          message: "models/gemini-old is not found for API version v1beta",
          status: "NOT_FOUND",
        },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await assert.rejects(
    async () => {
      await callGeminiApi({
        model: "gemini-old",
        prompt: { userPrompt: "test" },
        apiKey: "fake-key",
      })
    },
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 404)
      assert.match(errorWithStatus.message, /not found/i)
      return true
    }
  )
})

test("callGeminiApi throws error on network failure without leaking api key", async () => {
  globalThis.fetch = (async () => {
    throw new Error("Connection refused")
  }) as typeof fetch

  await assert.rejects(
    () =>
      callGeminiApi({
        model: "gemini-3.8-flash",
        prompt: { userPrompt: "test" },
        apiKey: "super-secret-api-key-12345",
      }),
    (err: unknown) => {
      const error = err as Error
      assert.match(
        error.message,
        /Failed to reach Gemini API for model gemini-3.8-flash: Connection refused/i
      )
      assert.ok(!error.message.includes("super-secret-api-key-12345"))
      return true
    }
  )
})

test("callGeminiApi throws error on non-json 200 response", async () => {
  globalThis.fetch = (async () => {
    return new Response("<html>Bad Gateway</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })
  }) as typeof fetch

  await assert.rejects(
    () =>
      callGeminiApi({
        model: "gemini-3.8-flash",
        prompt: { userPrompt: "test" },
        apiKey: "test-key",
      }),
    /Failed to parse Gemini API response as JSON/i
  )
})

test("callOpenAiCompatibleApi formats payload correctly for text mode", async () => {
  let capturedUrl = ""
  let capturedOptions: RequestInit | undefined

  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedUrl = url.toString()
    capturedOptions = init
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "OpenAI response",
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const response = await callOpenAiCompatibleApi({
    model: "meta-llama/Llama-3-8B-Instruct",
    prompt: {
      systemPrompt: "System instruction",
      userPrompt: "User prompt",
    },
    baseUrl: "http://localhost:8000/v1/",
    apiKey: "secret-bearer-token",
    temperature: 0.7,
    maxTokens: 500,
  })

  assert.equal(capturedUrl, "http://localhost:8000/v1/chat/completions")
  assert.equal(capturedOptions?.method, "POST")
  const headers = capturedOptions?.headers as Record<string, string>
  assert.equal(headers["Authorization"], "Bearer secret-bearer-token")
  assert.equal(headers["Content-Type"], "application/json")

  const body = JSON.parse(capturedOptions?.body as string)
  assert.equal(body.model, "meta-llama/Llama-3-8B-Instruct")
  assert.deepEqual(body.messages, [
    { role: "system", content: "System instruction" },
    { role: "user", content: "User prompt" },
  ])
  assert.equal(body.temperature, 0.7)
  assert.equal(body.max_tokens, 500)
  assert.equal(body.response_format, undefined)

  assert.equal(response.text, "OpenAI response")
  assert.ok(typeof response.durationMs === "number" && response.durationMs >= 0)
})

test("callOpenAiCompatibleApi handles missing apiKey without Authorization header", async () => {
  let capturedHeaders: Record<string, string> | undefined

  globalThis.fetch = (async (
    _url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedHeaders = init?.headers as Record<string, string>
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "OK" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await callOpenAiCompatibleApi({
    model: "local-model",
    prompt: { userPrompt: "Test" },
    baseUrl: "http://localhost:8000/v1",
  })

  assert.equal(capturedHeaders?.["Authorization"], undefined)
})

test("callOpenAiCompatibleApi sets json_object response_format in json mode", async () => {
  let capturedBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (
    _url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"status":"ok"}' } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await callOpenAiCompatibleApi({
    model: "qwen-2.5-7b",
    prompt: { userPrompt: "Generate json" },
    baseUrl: "http://localhost:8000/v1",
    responseFormat: "json",
  })

  assert.deepEqual(capturedBody?.response_format, { type: "json_object" })
  assert.deepEqual(capturedBody?.messages, [
    { role: "user", content: "Generate json" },
  ])
})

test("callOpenAiCompatibleApi throws error with status on HTTP failure", async () => {
  globalThis.fetch = (async () => {
    return new Response("Service Unavailable", { status: 503 })
  }) as typeof fetch

  await assert.rejects(
    async () => {
      await callOpenAiCompatibleApi({
        model: "qwen",
        prompt: { userPrompt: "Hi" },
        baseUrl: "http://localhost:8000/v1",
      })
    },
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 503)
      assert.match(errorWithStatus.message, /Service Unavailable/i)
      return true
    }
  )
})

test("callOpenAiCompatibleApi throws error on network failure", async () => {
  globalThis.fetch = (async () => {
    throw new Error("DNS resolution failed")
  }) as typeof fetch

  await assert.rejects(
    () =>
      callOpenAiCompatibleApi({
        model: "qwen",
        prompt: { userPrompt: "Hi" },
        baseUrl: "http://localhost:8000/v1",
      }),
    /Failed to reach OpenAI-compatible API.*DNS resolution failed/i
  )
})

test("discoverOpenAiModels fetches models and caches response for 5 minutes", async () => {
  let fetchCount = 0

  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    fetchCount++
    assert.equal(url.toString(), "http://localhost:8000/v1/models")
    const headers = init?.headers as Record<string, string> | undefined
    assert.equal(headers?.["Authorization"], "Bearer my-token")
    return new Response(
      JSON.stringify({
        data: [
          { id: "model-a", object: "model" },
          { id: "model-b", object: "model" },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  // First call should hit fetch
  const models1 = await discoverOpenAiModels(
    "http://localhost:8000/v1/",
    "my-token"
  )
  assert.deepEqual(models1, ["model-a", "model-b"])
  assert.equal(fetchCount, 1)

  // Second call within TTL should return cached models without fetch
  const models2 = await discoverOpenAiModels(
    "http://localhost:8000/v1",
    "my-token"
  )
  assert.deepEqual(models2, ["model-a", "model-b"])
  assert.equal(fetchCount, 1)

  // After cache clear, should hit fetch again
  _clearModelCache()
  const models3 = await discoverOpenAiModels(
    "http://localhost:8000/v1",
    "my-token"
  )
  assert.deepEqual(models3, ["model-a", "model-b"])
  assert.equal(fetchCount, 2)
})

test("discoverOpenAiModels refetches after TTL expires", async () => {
  let fetchCount = 0
  let simulatedTime = 1_000_000

  Date.now = () => simulatedTime

  globalThis.fetch = (async () => {
    fetchCount++
    return new Response(
      JSON.stringify({
        data: [{ id: "model-x" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await discoverOpenAiModels("http://localhost:8000/v1")
  assert.equal(fetchCount, 1)

  // Advance time by 4 minutes (under 5 minute TTL)
  simulatedTime += 4 * 60 * 1000
  await discoverOpenAiModels("http://localhost:8000/v1")
  assert.equal(fetchCount, 1)

  // Advance time past 5 minute TTL (total 6 minutes)
  simulatedTime += 2 * 60 * 1000
  await discoverOpenAiModels("http://localhost:8000/v1")
  assert.equal(fetchCount, 2)
})

test("discoverOpenAiModels throws error with status on HTTP error", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: { message: "Unauthorized" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await assert.rejects(
    async () => {
      await discoverOpenAiModels("http://localhost:8000/v1", "bad-token")
    },
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 401)
      assert.match(errorWithStatus.message, /Unauthorized/i)
      return true
    }
  )
})

test("discoverGeminiModels fetches models from Gemini API and caches for 5 minutes", async () => {
  let fetchCount = 0
  let capturedUrl = ""

  globalThis.fetch = (async (url: string | URL | Request) => {
    fetchCount++
    capturedUrl = String(url)
    return new Response(
      JSON.stringify({
        models: [
          {
            name: "models/gemini-3.8-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-3.1-pro-preview",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/text-embedding-004",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const models1 = await discoverGeminiModels("test-key-12345678")
  assert.equal(fetchCount, 1)
  assert.match(
    capturedUrl,
    /generativelanguage\.googleapis\.com\/v1beta\/models\?key=test-key-12345678/
  )
  assert.deepEqual(models1, ["gemini-3.8-flash", "gemini-3.1-pro-preview"])

  // Second call within 5 minutes uses cache
  const models2 = await discoverGeminiModels("test-key-12345678")
  assert.equal(fetchCount, 1)
  assert.deepEqual(models2, models1)
})

test("discoverGeminiModels throws error with status on HTTP error", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: { message: "API key expired" },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  await assert.rejects(
    async () => {
      await discoverGeminiModels("invalid-key")
    },
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 400)
      assert.match(errorWithStatus.message, /API key expired/i)
      return true
    }
  )
})
