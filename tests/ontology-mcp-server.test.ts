import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

import { POST } from "../src/app/api/mcp/route"
import { ALL_ONTOLOGY_TOOLS } from "../src/features/ontology/server/assistant-tools/registry"
import { authorizeMcpRequest } from "../src/server/mcp/auth"

const ENV_KEYS = ["KG_MCP_TOKEN", "KG_MCP_GROUP_KEY"] as const

let originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>

beforeEach(() => {
  originalEnv = {}
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test("authorizeMcpRequest fails closed with 401 when KG_MCP_TOKEN is unset", () => {
  const result = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer any-token",
      },
    })
  )

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 401)
  }
})

test("authorizeMcpRequest returns 401 when Authorization header is missing or wrong", () => {
  process.env.KG_MCP_TOKEN = "super-secret-token"

  const missingHeader = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", { method: "POST" })
  )
  assert.equal(missingHeader.ok, false)
  if (!missingHeader.ok) {
    assert.equal(missingHeader.status, 401)
  }

  const wrongToken = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
      },
    })
  )
  assert.equal(wrongToken.ok, false)
  if (!wrongToken.ok) {
    assert.equal(wrongToken.status, 401)
  }
})

test("authorizeMcpRequest returns ok and resolves groupKey from header, env, or shared default", () => {
  process.env.KG_MCP_TOKEN = "super-secret-token"

  const withHeader = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-token",
        "x-kg-group-key": "marine-team",
      },
    })
  )
  assert.deepEqual(withHeader, { ok: true, groupKey: "marine-team" })

  process.env.KG_MCP_GROUP_KEY = "env-group"
  const withEnv = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-token",
      },
    })
  )
  assert.deepEqual(withEnv, { ok: true, groupKey: "env-group" })

  delete process.env.KG_MCP_GROUP_KEY
  const withDefault = authorizeMcpRequest(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-token",
      },
    })
  )
  assert.deepEqual(withDefault, { ok: true, groupKey: "shared" })
})

test("POST /api/mcp rejects unauthorized requests with 401", async () => {
  process.env.KG_MCP_TOKEN = "super-secret-token"

  const response = await POST(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    })
  )

  assert.equal(response.status, 401)
})

test("POST /api/mcp handles initialize and tools/list returning all 28 ontology tools", async () => {
  process.env.KG_MCP_TOKEN = "super-secret-token"

  const initResponse = await POST(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-token",
        "x-kg-group-key": "marine-team",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    })
  )

  assert.equal(initResponse.status, 200)
  const initPayload = (await initResponse.json()) as {
    jsonrpc: string
    id: number
    result?: {
      protocolVersion?: string
      serverInfo?: { name: string; version: string }
      capabilities?: { tools?: unknown }
    }
  }
  assert.equal(initPayload.jsonrpc, "2.0")
  assert.equal(initPayload.id, 1)
  assert.ok(initPayload.result?.serverInfo?.name)
  assert.ok(initPayload.result?.capabilities?.tools)

  const listResponse = await POST(
    new Request("http://localhost:3010/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-token",
        "x-kg-group-key": "marine-team",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    })
  )

  assert.equal(listResponse.status, 200)
  const listPayload = (await listResponse.json()) as {
    jsonrpc: string
    id: number
    result?: {
      tools?: Array<{
        name: string
        description?: string
        inputSchema?: { type?: string; properties?: Record<string, unknown> }
      }>
    }
  }

  const expectedToolNames = Object.keys(ALL_ONTOLOGY_TOOLS).sort()
  const returnedTools = listPayload.result?.tools ?? []
  const returnedToolNames = returnedTools.map((t) => t.name).sort()

  assert.equal(expectedToolNames.length, 28)
  assert.deepEqual(returnedToolNames, expectedToolNames)

  for (const tool of returnedTools) {
    assert.ok(tool.description && tool.description.length > 0)
    assert.equal(tool.inputSchema?.type, "object")
  }
})
