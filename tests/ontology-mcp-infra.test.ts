import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { NextRequest } from "next/server"

import { saveCanonicalOntology } from "../src/features/ontology/server/linkml/document-store"
import type { DbTransaction } from "../src/features/ontology/server/linkml/symbol-cascade"
import { proxy } from "../src/proxy"
import {
  getCurrentGroupKeyOrThrow,
  runWithGroupKey,
} from "../src/server/group-access"

const envKeys = [
  "APP_PASSWORD_PROTECTION_ENABLED",
  "APP_PASSWORD",
  "APP_ACCESS_PASSWORD",
  "APP_ACCESS_GROUPS",
] as const

let originalEnv: Partial<Record<(typeof envKeys)[number], string>>

beforeEach(() => {
  originalEnv = {}
  for (const key of envKeys) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test("runWithGroupKey sets the active group key without cookies", async () => {
  process.env.APP_PASSWORD_PROTECTION_ENABLED = "true"
  process.env.APP_PASSWORD = "secret"

  const groupKey = await runWithGroupKey("marine-team", () =>
    getCurrentGroupKeyOrThrow()
  )
  assert.equal(groupKey, "marine-team")
})

test("proxy bypasses auth redirect for /api/mcp and /api/mcp/* routes", async () => {
  process.env.APP_PASSWORD_PROTECTION_ENABLED = "true"
  process.env.APP_PASSWORD = "secret"
  process.env.APP_ACCESS_PASSWORD = "secret"

  const rootResponse = await proxy(
    new NextRequest("http://localhost:3010/api/mcp", { method: "POST" })
  )
  assert.equal(rootResponse.status, 200)
  assert.equal(rootResponse.headers.get("location"), null)

  const subResponse = await proxy(
    new NextRequest("http://localhost:3010/api/mcp/sse", { method: "GET" })
  )
  assert.equal(subResponse.status, 200)
  assert.equal(subResponse.headers.get("location"), null)
})

test("saveCanonicalOntology uses options.tx directly without calling database.transaction", async () => {
  let transactionCalled = false
  const recorded: { updateSetValues: Record<string, unknown> | null } = {
    updateSetValues: null,
  }

  const mockDb = {
    select: () => ({
      from: () => ({
        where: async () => [],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
    transaction: async () => {
      transactionCalled = true
      throw new Error(
        "database.transaction should not be called when options.tx is provided"
      )
    },
  }

  const mockTx: DbTransaction = {
    select: () => ({
      from: () => ({
        where: async () =>
          [
            {
              id: "onto-1",
              name: "Marine Ontology",
              version: "1.0.0",
              default_language: "en",
              usecase: "Testing",
              group_key: "marine-team",
              linkml_yaml: "",
              ui_layout: { classPositions: {}, moduleLayouts: {} },
            },
          ] as unknown as Array<{ id: string }>,
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        recorded.updateSetValues = values
        return {
          where: async () => undefined,
        }
      },
    }),
    delete: () => ({
      where: async () => undefined,
    }),
  }

  const saved = await saveCanonicalOntology(
    "onto-1",
    (draft) => {
      draft.document.name = "Updated Marine Ontology"
    },
    { db: mockDb, tx: mockTx }
  )

  assert.equal(transactionCalled, false)
  assert.equal(saved.document.name, "Updated Marine Ontology")
  assert.ok(recorded.updateSetValues)
  assert.equal(recorded.updateSetValues.name, "Updated Marine Ontology")
})
