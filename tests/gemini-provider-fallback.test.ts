import assert from "node:assert/strict"
import { test } from "node:test"

test("requestGeminiDraft falls back to next model on 503 and succeeds", async () => {
  const { requestGeminiDraft } =
    await import("../src/features/ontology/server/services/ai-ontology-generator/gemini-provider")

  const originalFetch = globalThis.fetch
  let callCount = 0
  const calledModels: string[] = []

  // @ts-expect-error test mock
  globalThis.fetch = async (url: string | URL | Request) => {
    callCount++
    const urlStr = String(url)
    const modelMatch = urlStr.match(/models\/([^:]+):generateContent/)
    if (modelMatch && modelMatch[1]) {
      calledModels.push(modelMatch[1])
    }

    if (callCount === 1) {
      // First model fails with 503 Service Unavailable / High demand
      return {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () =>
          JSON.stringify({
            error: {
              code: 503,
              message:
                "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
              status: "UNAVAILABLE",
            },
          }),
      }
    }

    // Second model succeeds with valid JSON schema
    const mockDraft = {
      modules: [{ name: "Core", description: "Core domain module" }],
      classes: [
        {
          name: "Device",
          description: "Physical sensor device",
          moduleName: "Core",
          attributes: [],
        },
      ],
      relations: [],
      cqMappings: [],
      suggestedContext: [],
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockDraft) }],
            },
          },
        ],
      }),
    }
  }

  try {
    const result = await requestGeminiDraft(
      { systemPrompt: "test system", userPrompt: "test user" },
      {
        apiKey: "fake-test-key",
        model: "gemini-3.8-flash",
        candidateModels: ["gemini-3.8-flash", "gemini-2.5-pro"],
      }
    )

    assert.equal(callCount, 2, "should have retried with second model")
    assert.equal(calledModels[0], "gemini-3.8-flash")
    assert.equal(calledModels[1], "gemini-2.5-pro")
    assert.equal(result.classes[0]?.name, "Device")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("requestGeminiDraft throws clear error when all candidate models fail with 503", async () => {
  const { requestGeminiDraft } =
    await import("../src/features/ontology/server/services/ai-ontology-generator/gemini-provider")

  const originalFetch = globalThis.fetch
  // @ts-expect-error test mock
  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "High demand spike",
    }
  }

  try {
    await assert.rejects(
      () =>
        requestGeminiDraft(
          { systemPrompt: "test system", userPrompt: "test user" },
          {
            apiKey: "fake-test-key",
            model: "gemini-3.8-flash",
            candidateModels: ["gemini-3.8-flash", "gemini-2.5-pro"],
          }
        ),
      /Gemini generation failed across all attempted models \(gemini-3.8-flash, gemini-2.5-pro\)/
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
