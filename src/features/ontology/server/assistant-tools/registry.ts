import { READ_TOOLS } from "./read-tools"
import type { OntologyToolDefinition } from "./types"
import { WRITE_TOOLS } from "./write-tools"

/**
 * Unified registry of all 28 Ontology Tool Engine tools (12 read + 16 write).
 */
export const ALL_ONTOLOGY_TOOLS = {
  ...READ_TOOLS,
  ...WRITE_TOOLS,
} as const

export type OntologyToolName = keyof typeof ALL_ONTOLOGY_TOOLS

/**
 * Looks up an ontology tool definition by name.
 */
export function getOntologyTool(
  name: string
): OntologyToolDefinition<never, unknown> | undefined {
  if (!(name in ALL_ONTOLOGY_TOOLS)) {
    return undefined
  }
  return ALL_ONTOLOGY_TOOLS[
    name as OntologyToolName
  ] as unknown as OntologyToolDefinition<never, unknown>
}
