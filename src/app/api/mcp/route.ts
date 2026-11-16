import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { NextResponse } from "next/server"

import { authorizeMcpRequest } from "@/server/mcp/auth"
import { createOntologyMcpServer } from "@/server/mcp/ontology-mcp-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = authorizeMcpRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const server = createOntologyMcpServer(auth.groupKey)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    return await transport.handleRequest(request)
  } finally {
    await transport.close()
    await server.close()
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request)
}
