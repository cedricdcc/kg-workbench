import assert from "node:assert/strict"
import { test } from "node:test"
import { requestGeminiDraft } from "../src/features/ontology/server/services/ai-ontology-generator/gemini-provider"
import { requestOllamaDraft } from "../src/features/ontology/server/services/ai-ontology-generator/ollama-provider"
import { executeAiGeneration } from "../src/features/ontology/server/services/ai-ontology-generator"

const sampleDraft = {
  modules: [{ name: "Core", description: "Core module" }],
  classes: [
    {
      name: "Device",
      description: "Sensor device",
      moduleName: "Core",
      attributes: [
        {
          name: "serialNumber",
          dataType: "xsd:string",
          description: "Device serial",
        },
      ],
    },
  ],
  relations: [
    {
      name: "measures",
      description: "Measures property",
      domainClassName: "Device",
      rangeClassName: "Observation",
    },
  ],
  cqMappings: [
    {
      cqId: "11111111-1111-4111-8111-111111111111",
      subjectClassName: "Device",
      predicateRelationName: "measures",
      objectClassName: "Observation",
      moduleNames: ["Core"],
      triples: [
        {
          subjectClassName: "Device",
          predicateRelationName: "measures",
          objectClassName: "Observation",
        },
      ],
    },
  ],
}

test("requestGeminiDraft generates structured ontology draft via LlmClient", async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ""

  // @ts-expect-error test mock
  globalThis.fetch = async (url: string | URL | Request) => {
    capturedUrl = String(url)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(sampleDraft) }],
            },
          },
        ],
      }),
    }
  }

  try {
    const draft = await requestGeminiDraft(
      {
        systemPrompt: "You are an ontology expert.",
        userPrompt: "Build an IoT ontology.",
      },
      {
        apiKey: "fake-test-key",
        model: "gemini-3.8-flash",
      }
    )

    assert.ok(capturedUrl.includes("gemini-3.8-flash:generateContent"))
    assert.ok(capturedUrl.includes("key=fake-test-key"))
    assert.equal(draft.modules.length, 1)
    assert.equal(draft.modules[0].name, "Core")
    assert.equal(draft.classes.length, 1)
    assert.equal(draft.classes[0].name, "Device")
    assert.equal(draft.relations.length, 1)
    assert.equal(draft.relations[0].name, "measures")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("requestGeminiDraft handles candidate fallback and strips markdown fences", async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  const calledModels: string[] = []

  // @ts-expect-error test mock
  globalThis.fetch = async (url: string | URL | Request) => {
    callCount++
    const urlStr = String(url)
    const match = urlStr.match(/models\/([^:]+):generateContent/)
    if (match?.[1]) {
      calledModels.push(match[1])
    }

    if (callCount === 1) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Model not found",
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: "```json\n" + JSON.stringify(sampleDraft) + "\n```" },
              ],
            },
          },
        ],
      }),
    }
  }

  try {
    const draft = await requestGeminiDraft(
      {
        systemPrompt: "sys",
        userPrompt: "user",
      },
      {
        apiKey: "fake-key",
        model: "gemini-3.8-flash",
        candidateModels: ["gemini-3.8-flash", "gemini-2.5-pro"],
      }
    )

    assert.equal(callCount, 2)
    assert.equal(calledModels[0], "gemini-3.8-flash")
    assert.equal(calledModels[1], "gemini-2.5-pro")
    assert.equal(draft.classes[0]?.name, "Device")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("requestOllamaDraft delegates to vLLM OpenAI-compatible endpoint with explicit model", async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl = ""
  let capturedBody: Record<string, unknown> | null = null

  // @ts-expect-error test mock
  globalThis.fetch = async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    capturedUrl = String(url)
    if (init?.body) {
      capturedBody = JSON.parse(String(init.body))
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleDraft),
            },
          },
        ],
      }),
    }
  }

  try {
    const draft = await requestOllamaDraft(
      {
        systemPrompt: "System ontology prompt",
        userPrompt: "Generate ontology for smart home",
      },
      {
        baseUrl: "http://my-vllm-host:8000/v1",
        model: "meta-llama/Llama-3-8B-Instruct",
      }
    )

    assert.equal(capturedUrl, "http://my-vllm-host:8000/v1/chat/completions")
    const body = capturedBody as { model?: string } | null
    assert.equal(body?.model, "meta-llama/Llama-3-8B-Instruct")
    assert.equal(draft.modules[0].name, "Core")
    assert.equal(draft.classes[0].name, "Device")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("requestOllamaDraft discovers active model when model is omitted", async () => {
  const originalFetch = globalThis.fetch
  const calls: string[] = []

  // @ts-expect-error test mock
  globalThis.fetch = async (url: string | URL | Request) => {
    const urlStr = String(url)
    calls.push(urlStr)

    if (urlStr.endsWith("/models")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "mistralai/Mistral-7B-Instruct-v0.3" }],
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(sampleDraft),
            },
          },
        ],
      }),
    }
  }

  try {
    const draft = await requestOllamaDraft(
      {
        systemPrompt: "System",
        userPrompt: "User",
      },
      {
        baseUrl: "http://localhost:8000/v1",
      }
    )

    assert.ok(calls.some((u) => u.includes("/models")))
    assert.ok(calls.some((u) => u.includes("/chat/completions")))
    assert.equal(draft.modules[0].name, "Core")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("executeAiGeneration routes gemini and ollama providers through LlmClient", async () => {
  const originalFetch = globalThis.fetch

  // @ts-expect-error test mock
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(sampleDraft) }],
          },
        },
      ],
      choices: [
        {
          message: {
            content: JSON.stringify(sampleDraft),
          },
        },
      ],
    }),
  })

  try {
    const geminiDraft = await executeAiGeneration(
      {
        ontologyName: "TestOntology",
        usecase: "Testing",
        existingModules: [],
        existingClasses: [],
        existingRelations: [],
        competencyQuestions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            question: "What devices exist?",
          },
        ],
      },
      {
        provider: "gemini",
        apiKey: "fake-key",
      }
    )
    assert.equal(geminiDraft.classes[0].name, "Device")

    const ollamaDraft = await executeAiGeneration(
      {
        ontologyName: "TestOntology",
        usecase: "Testing",
        existingModules: [],
        existingClasses: [],
        existingRelations: [],
        competencyQuestions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            question: "What devices exist?",
          },
        ],
      },
      {
        provider: "ollama",
        baseUrl: "http://localhost:8000/v1",
        model: "llama3",
      }
    )
    assert.equal(ollamaDraft.classes[0].name, "Device")
  } finally {
    globalThis.fetch = originalFetch
  }
})
