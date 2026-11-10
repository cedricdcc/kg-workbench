import type { ImportOntology } from "@/features/ontology/schemas/import"
import type { ImportIdMaps, ServerClient } from "./shared-types"

export async function appendVisualInserts(_args: {
  db: ServerClient
  ontologyId: string
  parsed: ImportOntology
  warnings: string[]
  idMaps: ImportIdMaps
}) {
  void _args
  // Visual layout is mapped and persisted directly into ontology_documents.ui_layout during persistOntologyStructure.
}
