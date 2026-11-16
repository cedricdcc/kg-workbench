import "server-only"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { ALL_ONTOLOGY_TOOLS } from "@/features/ontology/server/assistant-tools/registry"
import type { OntologyToolDefinition } from "@/features/ontology/server/assistant-tools/types"
import { runWithGroupKey } from "@/server/group-access"

/**
 * Creates a stateless McpServer instance bound to the given access groupKey,
 * exposing all shared Ontology Tool Engine tools.
 */
export function createOntologyMcpServer(groupKey: string): McpServer {
  const server = new McpServer({
    name: "kg-workbench-ontology",
    version: "1.0.0",
  })

  for (const rawTool of Object.values(ALL_ONTOLOGY_TOOLS)) {
    const tool = rawTool as unknown as OntologyToolDefinition

    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.mode === "read",
        },
      },
      async (args) => {
        try {
          const result = await runWithGroupKey(groupKey, () =>
            tool.execute({ groupKey }, args)
          )
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          }
        }
      }
    )
  }

  return server
}
