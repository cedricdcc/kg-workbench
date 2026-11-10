"use server"

import type { OntologyModule } from "@/domain/ontology"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"

export async function getOntologyModules(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyModule[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.modules ?? [])
    .map((m) => ({
      id: m.id,
      ontology_id: snapshot.document.id,
      name: m.name,
      description: m.description ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
