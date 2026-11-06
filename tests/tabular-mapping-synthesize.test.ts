import assert from "node:assert/strict"
import { test, afterEach } from "node:test"
import { synthesizeOntologyMappingsAction } from "../src/features/tabular/server/actions/synthesize-mappings"
import type { TabularColumnProfile } from "../src/features/tabular/types"

interface MockChain {
  where: () => MockChain
  orderBy: () => MockChain
  limit: () => Promise<unknown[]>
  then: <TResult1 = unknown[], TResult2 = never>(
    onfulfilled?:
      ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) => Promise<unknown[] | TResult>
}

function createMockChain(value: unknown[] = []): MockChain {
  const chain: MockChain = {
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(value),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(value).then(onfulfilled, onrejected),
    catch: (onrejected) => Promise.resolve(value).catch(onrejected),
  }
  return chain
}

function setupMockDb() {
  const mockDb = {
    select: () => ({
      from: () => createMockChain([]),
    }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.kgWorkbenchDrizzle = mockDb as any
}

const originalFetch = globalThis.fetch
const originalDrizzle = globalThis.kgWorkbenchDrizzle
const originalGeminiKey = process.env.GEMINI_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.kgWorkbenchDrizzle = originalDrizzle
  if (originalGeminiKey !== undefined) {
    process.env.GEMINI_API_KEY = originalGeminiKey
  } else {
    delete process.env.GEMINI_API_KEY
  }
})

const testColumns: TabularColumnProfile[] = [
  {
    name: "user_id",
    duckdbType: "VARCHAR",
    inferredKgType: "string",
    nullCount: 0,
    nullPercentage: 0,
    distinctCount: 5,
    isUniqueCandidate: true,
    sampleValues: ["USR-1", "USR-2"],
  },
  {
    name: "email",
    duckdbType: "VARCHAR",
    inferredKgType: "string",
    nullCount: 0,
    nullPercentage: 0,
    distinctCount: 5,
    isUniqueCandidate: true,
    sampleValues: ["test.user@example.com"],
  },
]

test("synthesizeOntologyMappingsAction succeeds when primary model returns 404 and fallback model succeeds", async () => {
  setupMockDb()
  process.env.GEMINI_API_KEY = "test-gemini-key"

  const attemptedModels: string[] = []

  const validMappingSpec = {
    targetClassName: "UserProfile",
    primaryKeyColumn: "user_id",
    columnMappings: [
      {
        columnName: "user_id",
        inferredType: "string",
        targetKind: "attribute",
        targetAttributeName: "userId",
        targetDataType: "xsd:string",
        isPrimaryKey: true,
      },
      {
        columnName: "email",
        inferredType: "string",
        targetKind: "attribute",
        targetAttributeName: "emailAddress",
        targetDataType: "xsd:string",
      },
    ],
    synthesizedElements: {
      classes: [{ name: "UserProfile", description: "User profile entity" }],
      attributes: [],
      relations: [],
    },
  }

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString()
    if (urlStr.includes("models/gemini-3.8-flash")) {
      attemptedModels.push("gemini-3.8-flash")
      return new Response(
        JSON.stringify({
          error: {
            code: 404,
            message: "models/gemini-3.8-flash is not available",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    if (urlStr.includes("models/gemini-2.5-pro")) {
      attemptedModels.push("gemini-2.5-pro")
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validMappingSpec) }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response("Unexpected model request", { status: 500 })
  }) as typeof fetch

  const result = await synthesizeOntologyMappingsAction({
    ontologyId: "00000000-0000-0000-0000-000000000001",
    sourceName: "users.csv",
    profile: {
      rowCount: 5,
      columnCount: 2,
      candidateKeys: [["user_id"]],
      columns: testColumns,
    },
    sampleRows: [{ user_id: "USR-1", email: "test.user@example.com" }],
  })

  assert.equal(result.success, true)
  if (!result.success) return

  assert.equal(result.mappingSpec.targetClassName, "UserProfile")
  assert.equal(result.mappingSpec.primaryKeyColumn, "user_id")
  assert.deepEqual(attemptedModels, ["gemini-3.8-flash", "gemini-2.5-pro"])
})

test("synthesizeOntologyMappingsAction returns sanitized and masked results conforming to DatasetMappingSpec", async () => {
  setupMockDb()
  process.env.GEMINI_API_KEY = "test-gemini-key"

  const mockAiResponse = {
    targetClassName: "MemberRecord",
    primaryKeyColumn: "user_id",
    columnMappings: [
      {
        columnName: "user_id",
        inferredType: "string",
        targetKind: "attribute",
        targetAttributeName: "id",
        targetDataType: "xsd:string",
        isPrimaryKey: true,
      },
      {
        columnName: "email",
        inferredType: "string",
        targetKind: "attribute",
        targetAttributeName: "contactEmail",
        targetDataType: "xsd:string",
      },
    ],
    synthesizedElements: {
      classes: [
        {
          name: "MemberRecord",
          description:
            "Member with email <EMAIL_1> and verified status [REDACTED].",
        },
      ],
      attributes: [],
      relations: [],
    },
  }

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAiResponse) }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const result = await synthesizeOntologyMappingsAction({
    ontologyId: "00000000-0000-0000-0000-000000000001",
    sourceName: "members.csv",
    profile: {
      rowCount: 1,
      columnCount: 2,
      candidateKeys: [["user_id"]],
      columns: testColumns,
    },
    sampleRows: [{ user_id: "USR-1", email: "test.user@example.com" }],
  })

  assert.equal(result.success, true)
  if (!result.success) return

  assert.equal(result.privacySummary.maskedColumnCount, 1)
  const classDesc =
    result.mappingSpec.synthesizedElements?.classes?.[0]?.description
  assert.equal(classDesc?.includes("<EMAIL_1>"), false)
  assert.equal(classDesc?.includes("[REDACTED]"), false)
  assert.equal(classDesc, "Member with email and verified status.")
})

test("synthesizeOntologyMappingsAction returns error when ontologyId is empty", async () => {
  const result = await synthesizeOntologyMappingsAction({
    ontologyId: "",
    sourceName: "test.csv",
    profile: {
      rowCount: 0,
      columnCount: 0,
      candidateKeys: [],
      columns: [],
    },
    sampleRows: [],
  })

  assert.equal(result.success, false)
  if (result.success) return
  assert.match(result.error, /ontologyId is required/i)
})

test("synthesizeOntologyMappingsAction returns error when Gemini API key is not configured", async () => {
  setupMockDb()
  delete process.env.GEMINI_API_KEY

  const result = await synthesizeOntologyMappingsAction({
    ontologyId: "00000000-0000-0000-0000-000000000001",
    sourceName: "test.csv",
    profile: {
      rowCount: 0,
      columnCount: 0,
      candidateKeys: [],
      columns: [],
    },
    sampleRows: [],
  })

  assert.equal(result.success, false)
  if (result.success) return
  assert.match(result.error, /Gemini API key is not configured/i)
})

test("synthesizeOntologyMappingsAction returns error when all candidate models fail", async () => {
  setupMockDb()
  process.env.GEMINI_API_KEY = "test-gemini-key"

  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        error: { code: 503, message: "Gemini capacity exceeded" },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const result = await synthesizeOntologyMappingsAction({
    ontologyId: "00000000-0000-0000-0000-000000000001",
    sourceName: "test.csv",
    profile: {
      rowCount: 1,
      columnCount: 2,
      candidateKeys: [["user_id"]],
      columns: testColumns,
    },
    sampleRows: [{ user_id: "USR-1", email: "test.user@example.com" }],
  })

  assert.equal(result.success, false)
  if (result.success) return
  assert.match(result.error, /Failed to synthesize mappings/i)
})
