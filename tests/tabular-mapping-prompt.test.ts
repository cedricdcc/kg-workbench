import assert from "node:assert/strict"
import { test } from "node:test"
import { buildAiMappingPrompt } from "../src/features/tabular/server/services/ai-mapping-prompt"
import { synthesizeOntologyMappingsAction } from "../src/features/tabular/server/actions/synthesize-mappings"
import type { ColumnPrivacyConfig } from "../src/features/tabular/server/services/pii-masker"

interface MockChain {
  where: () => MockChain
  orderBy: () => MockChain
  limit: () => Promise<unknown[]>
  then: <TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
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

test("buildAiMappingPrompt masks sensitive sampleRows and sampleValues when privacyConfigs are provided", () => {
  const privacyConfigs: ColumnPrivacyConfig[] = [
    {
      columnName: "customer_id",
      isMasked: false,
      maskingStrategy: "none",
    },
    {
      columnName: "email",
      isMasked: true,
      detectedCategory: "email",
      maskingStrategy: "token",
    },
    {
      columnName: "ssn",
      isMasked: true,
      detectedCategory: "ssn",
      maskingStrategy: "token",
    },
    {
      columnName: "credit_card",
      isMasked: true,
      detectedCategory: "credit_card",
      maskingStrategy: "token",
    },
    {
      columnName: "notes",
      isMasked: true,
      maskingStrategy: "redact",
    },
  ]

  const prompt = buildAiMappingPrompt({
    sourceName: "customers.csv",
    profile: {
      rowCount: 10,
      columnCount: 5,
      candidateKeys: [["customer_id"]],
      columns: [
        {
          name: "customer_id",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["CUST-001", "CUST-002"],
        },
        {
          name: "email",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["alice.smith@example.com", "bob.jones@example.com"],
        },
        {
          name: "ssn",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["123-45-6789"],
        },
        {
          name: "credit_card",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 10,
          isUniqueCandidate: true,
          sampleValues: ["4532-0150-1234-5678"],
        },
        {
          name: "notes",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 5,
          isUniqueCandidate: false,
          sampleValues: ["Confidential medical review notes"],
        },
      ],
    },
    sampleRows: [
      {
        customer_id: "CUST-001",
        email: "alice.smith@example.com",
        ssn: "123-45-6789",
        credit_card: "4532-0150-1234-5678",
        notes: "Confidential medical review notes",
      },
    ],
    existingClasses: [
      {
        id: "c-1",
        name: "Customer",
        attributes: [{ name: "emailAddress", dataType: "xsd:string" }],
      },
    ],
    existingRelations: [],
    privacyConfigs,
  })

  // Zero raw PII in prompt
  assert.equal(prompt.userPrompt.includes("alice.smith@example.com"), false)
  assert.equal(prompt.userPrompt.includes("bob.jones@example.com"), false)
  assert.equal(prompt.userPrompt.includes("123-45-6789"), false)
  assert.equal(prompt.userPrompt.includes("4532-0150-1234-5678"), false)
  assert.equal(prompt.userPrompt.includes("Confidential medical review notes"), false)

  // Token placeholders present
  assert.ok(prompt.userPrompt.includes("<EMAIL_1>"))
  assert.ok(prompt.userPrompt.includes("<SSN_1>"))
  assert.ok(prompt.userPrompt.includes("<CREDIT_CARD_1>"))
  assert.ok(prompt.userPrompt.includes("[REDACTED]"))

  // Non-masked identifier is preserved
  assert.ok(prompt.userPrompt.includes("CUST-001"))
})

test("synthesizeOntologyMappingsAction auto-detects PII, masks prompt, sanitizes output, and returns privacySummary", async () => {
  const originalFetch = globalThis.fetch
  const originalDrizzle = globalThis.kgWorkbenchDrizzle
  const originalGeminiKey = process.env.GEMINI_API_KEY

  process.env.GEMINI_API_KEY = "mock-test-gemini-key"

  // Mock Drizzle database to return empty ontology classes and relations
  const mockDb = {
    select: () => ({
      from: () => createMockChain([]),
    }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.kgWorkbenchDrizzle = mockDb as any

  let capturedPrompt = ""

  // @ts-expect-error test mock
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init && typeof init.body === "string") {
      const parsedBody = JSON.parse(init.body)
      capturedPrompt = parsedBody.contents?.[0]?.parts?.[0]?.text || ""
    }

    const mockAiResponse = {
      targetClassName: "CustomerAccount",
      primaryKeyColumn: "account_id",
      columnMappings: [
        {
          columnName: "account_id",
          inferredType: "string",
          targetKind: "attribute",
          targetAttributeName: "accountId",
          targetDataType: "xsd:string",
          isPrimaryKey: true,
        },
        {
          columnName: "contact_email",
          inferredType: "string",
          targetKind: "attribute",
          targetAttributeName: "emailAddress",
          targetDataType: "xsd:string",
        },
      ],
      synthesizedElements: {
        classes: [
          {
            name: "CustomerAccount",
            description: "Account representing <EMAIL_1> with [REDACTED] credentials.",
          },
        ],
        attributes: [
          {
            className: "CustomerAccount",
            name: "accountId",
            dataType: "xsd:string",
          },
        ],
        relations: [],
      },
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAiResponse) }],
            },
          },
        ],
      }),
    }
  }

  try {
    const res = await synthesizeOntologyMappingsAction({
      ontologyId: "00000000-0000-0000-0000-000000000001",
      sourceName: "accounts.csv",
      profile: {
        rowCount: 5,
        columnCount: 3,
        candidateKeys: [["account_id"]],
        columns: [
          {
            name: "account_id",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 5,
            isUniqueCandidate: true,
            sampleValues: ["ACC-99"],
          },
          {
            name: "contact_email",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 5,
            isUniqueCandidate: true,
            sampleValues: ["secret.user@corp.com"],
          },
          {
            name: "ssn",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 5,
            isUniqueCandidate: true,
            sampleValues: ["999-12-3456"],
          },
        ],
      },
      sampleRows: [
        {
          account_id: "ACC-99",
          contact_email: "secret.user@corp.com",
          ssn: "999-12-3456",
        },
      ],
      // privacyConfigs omitted -> must auto-detect contact_email and ssn
    })

    assert.equal(res.success, true)
    if (!res.success) return

    // Privacy summary must report 2 auto-masked columns
    assert.equal(res.privacySummary.maskedColumnCount, 2)

    // Prompt sent to Gemini must contain NO raw email or SSN
    assert.equal(capturedPrompt.includes("secret.user@corp.com"), false)
    assert.equal(capturedPrompt.includes("999-12-3456"), false)
    assert.ok(capturedPrompt.includes("<EMAIL_1>"))
    assert.ok(capturedPrompt.includes("<SSN_1>"))
    assert.ok(capturedPrompt.includes("ACC-99"))

    // Output synthesized elements must be sanitized (token artifacts and [REDACTED] stripped)
    const classDesc = res.mappingSpec.synthesizedElements?.classes?.[0]?.description
    assert.equal(classDesc?.includes("<EMAIL_1>"), false)
    assert.equal(classDesc?.includes("[REDACTED]"), false)
    assert.equal(classDesc, "Account representing with credentials.")
  } finally {
    globalThis.fetch = originalFetch
    globalThis.kgWorkbenchDrizzle = originalDrizzle
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey
    } else {
      delete process.env.GEMINI_API_KEY
    }
  }
})

test("synthesizeOntologyMappingsAction respects user privacyConfigs overrides", async () => {
  const originalFetch = globalThis.fetch
  const originalDrizzle = globalThis.kgWorkbenchDrizzle
  const originalGeminiKey = process.env.GEMINI_API_KEY

  process.env.GEMINI_API_KEY = "mock-test-gemini-key"

  const mockDb = {
    select: () => ({
      from: () => createMockChain([]),
    }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.kgWorkbenchDrizzle = mockDb as any

  let capturedPrompt = ""

  // @ts-expect-error test mock
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    if (init && typeof init.body === "string") {
      const parsedBody = JSON.parse(init.body)
      capturedPrompt = parsedBody.contents?.[0]?.parts?.[0]?.text || ""
    }

    const mockAiResponse = {
      targetClassName: "Lead",
      primaryKeyColumn: "lead_code",
      columnMappings: [
        {
          columnName: "lead_code",
          inferredType: "string",
          targetKind: "attribute",
          isPrimaryKey: true,
        },
        {
          columnName: "support_phone",
          inferredType: "string",
          targetKind: "attribute",
        },
      ],
      synthesizedElements: { classes: [], attributes: [], relations: [] },
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockAiResponse) }] } }],
      }),
    }
  }

  try {
    // User unmasks support_phone (e.g. false positive public toll-free number)
    const userConfigs: ColumnPrivacyConfig[] = [
      {
        columnName: "lead_code",
        isMasked: false,
        maskingStrategy: "none",
      },
      {
        columnName: "support_phone",
        isMasked: false,
        maskingStrategy: "none",
      },
    ]

    const res = await synthesizeOntologyMappingsAction({
      ontologyId: "00000000-0000-0000-0000-000000000001",
      sourceName: "leads.csv",
      profile: {
        rowCount: 1,
        columnCount: 2,
        candidateKeys: [["lead_code"]],
        columns: [
          {
            name: "lead_code",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 1,
            isUniqueCandidate: true,
            sampleValues: ["LD-01"],
          },
          {
            name: "support_phone",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 1,
            isUniqueCandidate: false,
            sampleValues: ["+1-800-555-0199"],
          },
        ],
      },
      sampleRows: [{ lead_code: "LD-01", support_phone: "+1-800-555-0199" }],
      privacyConfigs: userConfigs,
    })

    assert.equal(res.success, true)
    if (!res.success) return

    assert.equal(res.privacySummary.maskedColumnCount, 0)
    // support_phone is unmasked, so raw value must remain in prompt
    assert.ok(capturedPrompt.includes("+1-800-555-0199"))
  } finally {
    globalThis.fetch = originalFetch
    globalThis.kgWorkbenchDrizzle = originalDrizzle
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey
    } else {
      delete process.env.GEMINI_API_KEY
    }
  }
})
