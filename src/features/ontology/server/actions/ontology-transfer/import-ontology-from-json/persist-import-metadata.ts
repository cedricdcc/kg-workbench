import type { ImportOntology } from "@/features/ontology/schemas/import"
import type { ImportIdMaps, ServerClient } from "./shared-types"

export async function persistImportMetadata(_args: {
  db: ServerClient
  ontologyId: string
  parsed: ImportOntology
  idMaps: ImportIdMaps
  warnings: string[]
}) {
  void _args
  // All metadata (notes, localized texts) is compiled directly into
  // ontology_documents.linkml_yaml during persistOntologyStructure.
}
