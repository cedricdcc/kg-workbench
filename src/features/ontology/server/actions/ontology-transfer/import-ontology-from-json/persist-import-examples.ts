import type { ImportOntology } from "@/features/ontology/schemas/import"
import type {
  ImportIdMaps,
  PendingCQExampleRef,
  ServerClient,
} from "./shared-types"

export async function persistImportExamples(_args: {
  db: ServerClient
  ontologyId: string
  parsed: ImportOntology
  idMaps: ImportIdMaps
  pendingCQExampleRefs: PendingCQExampleRef[]
  warnings: string[]
}) {
  void _args
  // All examples are compiled directly into ontology_documents.linkml_yaml during persistOntologyStructure.
}
