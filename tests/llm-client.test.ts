import { test, afterEach } from "node:test"
import assert from "node:assert/strict"
import { z } from "zod"
import {
  LlmClient,
  getLlmClient,
  sanitizeJsonText,
} from "../src/server/llm/client"
import { _clearModelCache } from "../src/server/llm/providers/openai-compatible"

interface ErrorWithStatus extends Error {
  status?: number
}

const originalFetch = globalThis.fetch
const originalGeminiApiKey = process.env.GEMINI_API_KEY
const originalVllmBaseUrl = process.env.VLLM_BASE_URL
const originalVllmApiKey = process.env.VLLM_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env.GEMINI_API_KEY = originalGeminiApiKey
  process.env.VLLM_BASE_URL = originalVllmBaseUrl
  process.env.VLLM_API_KEY = originalVllmApiKey
  _clearModelCache()
})

test("sanitizeJsonText strips markdown fences, language identifiers, and whitespace", () => {
  assert.equal(sanitizeJsonText('{"key":"value"}'), '{"key":"value"}')
  assert.equal(
    sanitizeJsonText('```json\n{"key":"value"}\n```'),
    '{"key":"value"}'
  )
  assert.equal(
    sanitizeJsonText('```JSON\r\n{"key":"value"}\r\n```'),
    '{"key":"value"}'
  )
  assert.equal(
    sanitizeJsonText('```\n  {"key":"value"}  \n```'),
    '{"key":"value"}'
  )
  assert.equal(
    sanitizeJsonText('   ```json {"key":"value"}```   '),
    '{"key":"value"}'
  )
})

test("getLlmClient returns a singleton LlmClient instance", () => {
  const client1 = getLlmClient()
  const client2 = getLlmClient()
  assert.ok(client1 instanceof LlmClient)
  assert.equal(client1, client2)
})

test("generateText succeeds on primary model returning text and valid trace", async () => {
  let capturedUrl = ""
  globalThis.fetch = (async (url: string | URL | Request) => {
    capturedUrl = url.toString()
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: "Hello from Gemini" }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = new LlmClient()
  const result = await client.generateText(
    { userPrompt: "Say hello" },
    { apiKey: "test-key" }
  )

  assert.equal(result.text, "Hello from Gemini")
  assert.ok(capturedUrl.includes("models/gemini-3.8-flash:generateContent"))
  assert.equal(result.trace.provider, "gemini")
  assert.equal(result.trace.model, "gemini-3.8-flash")
  assert.equal(result.trace.attempts.length, 1)
  assert.equal(result.trace.attempts[0].model, "gemini-3.8-flash")
  assert.equal(result.trace.attempts[0].status, 200)
  assert.ok(result.trace.totalDurationMs >= 0)
})

test("generateStructured strips markdown fences and validates against Zod schema", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n{\n  "title": "AI Knowledge Graphs",\n  "count": 42\n}\n```',
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const schema = z.object({
    title: z.string(),
    count: z.number(),
  })

  const client = new LlmClient()
  const result = await client.generateStructured(
    { userPrompt: "Generate payload" },
    { schema, apiKey: "test-key" }
  )

  assert.deepEqual(result.data, {
    title: "AI Knowledge Graphs",
    count: 42,
  })
  assert.ok(result.rawText.includes("```json"))
  assert.equal(result.trace.attempts.length, 1)
  assert.equal(result.trace.attempts[0].status, 200)
  assert.equal(result.trace.model, "gemini-3.8-flash")
})

test("generateStructured supports plain JSON schema without safeParse", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"message":"ok","code":200}' }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = new LlmClient()
  const result = await client.generateStructured<{
    message: string
    code: number
  }>(
    { userPrompt: "Test" },
    {
      schema: { type: "object", properties: { message: { type: "string" } } },
      apiKey: "test-key",
    }
  )

  assert.deepEqual(result.data, { message: "ok", code: 200 })
  assert.equal(result.trace.attempts[0].status, 200)
})

test("candidate queue fallback on HTTP 404, 503, 429", async () => {
  const attemptedUrls: string[] = []

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString()
    attemptedUrls.push(urlStr)

    // First candidate gemini-3.8-flash returns 404 Not Found
    if (urlStr.includes("gemini-3.8-flash")) {
      return new Response(
        JSON.stringify({
          error: { code: 404, message: "Model gemini-3.8-flash not found" },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // Second candidate gemini-2.5-pro returns 200 OK
    if (urlStr.includes("gemini-2.5-pro")) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Fallback succeeded" }] },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response("Not expected", { status: 500 })
  }) as typeof fetch

  const client = new LlmClient()
  const result = await client.generateText(
    { userPrompt: "Test fallback" },
    { apiKey: "test-key" }
  )

  assert.equal(result.text, "Fallback succeeded")
  assert.equal(result.trace.model, "gemini-2.5-pro")
  assert.equal(result.trace.attempts.length, 2)
  assert.equal(result.trace.attempts[0].model, "gemini-3.8-flash")
  assert.equal(result.trace.attempts[0].status, 404)
  assert.match(result.trace.attempts[0].error || "", /404/i)
  assert.equal(result.trace.attempts[1].model, "gemini-2.5-pro")
  assert.equal(result.trace.attempts[1].status, 200)
})

test("schema failure fallback advances to next candidate model", async () => {
  let callCount = 0

  globalThis.fetch = (async () => {
    callCount++
    if (callCount === 1) {
      // First model returns JSON that fails schema validation
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"wrongKey": 123}' }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    // Second model returns schema-compliant JSON
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"title": "Valid title"}' }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const schema = z.object({
    title: z.string(),
  })

  const client = new LlmClient()
  const result = await client.generateStructured(
    { userPrompt: "Need title" },
    { schema, apiKey: "test-key" }
  )

  assert.deepEqual(result.data, { title: "Valid title" })
  assert.equal(result.trace.model, "gemini-2.5-pro")
  assert.equal(result.trace.attempts.length, 2)
  assert.equal(result.trace.attempts[0].model, "gemini-3.8-flash")
  assert.equal(result.trace.attempts[0].status, "schema_error")
  assert.ok(result.trace.attempts[0].error)
  assert.equal(result.trace.attempts[1].model, "gemini-2.5-pro")
  assert.equal(result.trace.attempts[1].status, 200)
})

test("invalid JSON parse error causes schema_error and fallback to next candidate", async () => {
  let callCount = 0

  globalThis.fetch = (async () => {
    callCount++
    if (callCount === 1) {
      // First model returns malformed JSON
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "This is not JSON at all" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"status": "recovered"}' }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const schema = z.object({
    status: z.string(),
  })

  const client = new LlmClient()
  const result = await client.generateStructured(
    { userPrompt: "Test syntax error" },
    { schema, apiKey: "test-key" }
  )

  assert.deepEqual(result.data, { status: "recovered" })
  assert.equal(result.trace.attempts[0].status, "schema_error")
  assert.match(result.trace.attempts[0].error || "", /JSON/i)
  assert.equal(result.trace.attempts[1].status, 200)
})

test("fail-fast immediately on HTTP 401 without trying remaining candidates", async () => {
  let fetchCount = 0

  globalThis.fetch = (async () => {
    fetchCount++
    return new Response(
      JSON.stringify({
        error: { code: 401, message: "API key not valid" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = new LlmClient()

  await assert.rejects(
    () =>
      client.generateText({ userPrompt: "Test 401" }, { apiKey: "bad-key" }),
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 401)
      return true
    }
  )

  // Verify only 1 attempt was made despite multiple candidates in queue
  assert.equal(fetchCount, 1)
})

test("fail-fast immediately on HTTP 403 without trying remaining candidates", async () => {
  let fetchCount = 0

  globalThis.fetch = (async () => {
    fetchCount++
    return new Response(
      JSON.stringify({
        error: { code: 403, message: "Permission denied" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = new LlmClient()

  await assert.rejects(
    () =>
      client.generateText(
        { userPrompt: "Test 403" },
        { apiKey: "forbidden-key" }
      ),
    (err: unknown) => {
      const errorWithStatus = err as ErrorWithStatus
      assert.equal(errorWithStatus.status, 403)
      return true
    }
  )

  assert.equal(fetchCount, 1)
})

test("auto-discovery for vLLM queries models and uses the first discovered model", async () => {
  let calledUrl = ""
  let requestBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    const urlStr = url.toString()
    if (urlStr.endsWith("/models")) {
      return new Response(
        JSON.stringify({
          data: [
            { id: "meta-llama/Llama-3.1-8B-Instruct" },
            { id: "mistral-7b" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    if (urlStr.endsWith("/chat/completions")) {
      calledUrl = urlStr
      requestBody = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "vLLM response" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response("Not found", { status: 404 })
  }) as typeof fetch

  const client = new LlmClient()
  const result = await client.generateText(
    { userPrompt: "Hello vLLM" },
    { provider: "vllm", baseUrl: "http://localhost:8000/v1" }
  )

  assert.equal(result.text, "vLLM response")
  assert.equal(calledUrl, "http://localhost:8000/v1/chat/completions")
  assert.equal(requestBody?.model, "meta-llama/Llama-3.1-8B-Instruct")
  assert.equal(result.trace.provider, "vllm")
  assert.equal(result.trace.model, "meta-llama/Llama-3.1-8B-Instruct")
  assert.equal(
    result.trace.attempts[0].model,
    "meta-llama/Llama-3.1-8B-Instruct"
  )
  assert.equal(result.trace.attempts[0].status, 200)
})

test("throws error when all candidate models fail", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: { code: 503, message: "Backend unavailable" },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = new LlmClient()

  await assert.rejects(
    () =>
      client.generateText(
        { userPrompt: "Test fail all" },
        {
          provider: "gemini",
          candidateModels: ["gemini-3.8-flash", "gemini-2.5-pro"],
          apiKey: "test-key",
        }
      ),
    /All candidate models failed for provider gemini/i
  )
})
