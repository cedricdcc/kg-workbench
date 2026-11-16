import "server-only"

import { timingSafeEqual } from "node:crypto"

export type McpAuthResult =
  { ok: true; groupKey: string } | { ok: false; status: number; error: string }

function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8")
  const bBuf = Buffer.from(b, "utf8")
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Authorizes an incoming `/api/mcp` request using Bearer `KG_MCP_TOKEN`
 * and resolves the target group key from `x-kg-group-key` or `KG_MCP_GROUP_KEY`.
 */
export function authorizeMcpRequest(request: Request): McpAuthResult {
  const expectedToken = process.env.KG_MCP_TOKEN?.trim()
  if (!expectedToken) {
    return {
      ok: false,
      status: 401,
      error: "MCP server authentication is not configured.",
    }
  }

  const authHeader = request.headers.get("authorization")
  const match = authHeader?.match(/^Bearer\s+(.+)$/i)
  const providedToken = match?.[1]?.trim()

  if (!providedToken || !constantTimeEquals(providedToken, expectedToken)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: invalid or missing Bearer token.",
    }
  }

  const groupKey =
    request.headers.get("x-kg-group-key")?.trim() ||
    process.env.KG_MCP_GROUP_KEY?.trim() ||
    "shared"

  return { ok: true, groupKey }
}
