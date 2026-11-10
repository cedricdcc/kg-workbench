"use server"

import type { OntologyRelationAttribute } from "@/domain/ontology"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type { OntologyRelationAttributeSnapshot } from "../linkml/types"

function projectRelationAttribute(
  ra: OntologyRelationAttributeSnapshot
): OntologyRelationAttribute {
  return {
    id: ra.id,
    relation_id: ra.relation_id,
    name: ra.name,
    data_type: ra.data_type ?? "string",
    description: ra.description ?? "",
    required: ra.required ?? false,
    sort_order: ra.sort_order ?? 0,
    created_at: new Date(0).toISOString(),
  }
}

export async function getRelationAttributes(
  relationId: string,
  ontologyId?: string,
  db?: AnyDbClient
): Promise<OntologyRelationAttribute[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  let targetOntologyId = ontologyId
  if (!targetOntologyId) {
    const docs = (await database.select().from(ontologyDocuments)) as Array<
      typeof ontologyDocuments.$inferSelect
    >

    for (const doc of docs) {
      if (doc.linkml_yaml && doc.linkml_yaml.includes(relationId)) {
        try {
          const snapshot = await loadCanonicalOntology(doc.id, database)
          const hasRel =
            snapshot.relations?.some((r) => r.id === relationId) ||
            snapshot.relation_attributes?.some(
              (ra) => ra.relation_id === relationId
            )
          if (hasRel) {
            targetOntologyId = doc.id
            break
          }
        } catch {
          // continue
        }
      }
    }
  }

  if (!targetOntologyId) return []

  await assertOntologyDocumentAccess(targetOntologyId, database)
  const snapshot = await loadCanonicalOntology(targetOntologyId, database)

  return (snapshot.relation_attributes ?? [])
    .filter((ra) => ra.relation_id === relationId)
    .map(projectRelationAttribute)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function getRelationAttributesByOntology(
  ontologyId: string,
  db?: AnyDbClient
): Promise<Record<string, OntologyRelationAttribute[]>> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  const result: Record<string, OntologyRelationAttribute[]> = {}
  for (const ra of snapshot.relation_attributes ?? []) {
    if (!result[ra.relation_id]) result[ra.relation_id] = []
    result[ra.relation_id].push(projectRelationAttribute(ra))
  }

  for (const key of Object.keys(result)) {
    result[key].sort((a, b) => a.sort_order - b.sort_order)
  }

  return result
}
