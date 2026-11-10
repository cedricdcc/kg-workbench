"use server"

import type { OntologyRelation } from "@/domain/ontology"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type {
  CanonicalOntologySnapshot,
  OntologyRelationSnapshot,
} from "../linkml/types"

function projectRelation(
  rel: OntologyRelationSnapshot,
  snapshot: CanonicalOntologySnapshot
): OntologyRelation {
  return {
    id: rel.id,
    ontology_id: snapshot.document.id,
    name: rel.name,
    domain_class_id: rel.domain_class_id,
    range_class_id: rel.range_class_id,
    description: rel.description ?? "",
    inverse_name: rel.inverse_name ?? null,
    cardinality: rel.cardinality ?? null,
    instance_policy: rel.instance_policy ?? "open",
  }
}

export async function getOntologyRelations(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyRelation[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.relations ?? [])
    .map((r) => projectRelation(r, snapshot))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getOntologyRelationById(
  firstArg: string,
  secondArg?: string,
  db?: AnyDbClient
): Promise<OntologyRelation> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  let ontologyId: string | undefined
  let relationId: string

  if (secondArg !== undefined) {
    ontologyId = firstArg
    relationId = secondArg
  } else {
    relationId = firstArg
  }

  if (ontologyId) {
    await assertOntologyDocumentAccess(ontologyId, database)
    const snapshot = await loadCanonicalOntology(ontologyId, database)
    const rel = snapshot.relations?.find((r) => r.id === relationId)
    if (!rel) {
      throw new Error("Ontology relation was not found.")
    }
    return projectRelation(rel, snapshot)
  }

  // If no ontologyId provided, find the document that defines this relation
  const docs = (await database.select().from(ontologyDocuments)) as Array<
    typeof ontologyDocuments.$inferSelect
  >

  for (const doc of docs) {
    if (doc.linkml_yaml && doc.linkml_yaml.includes(relationId)) {
      try {
        const snapshot = await loadCanonicalOntology(doc.id, database)
        const rel = snapshot.relations?.find((r) => r.id === relationId)
        if (rel) {
          await assertOntologyDocumentAccess(doc.id, database)
          return projectRelation(rel, snapshot)
        }
      } catch {
        // Continue searching
      }
    }
  }

  throw new Error("Ontology relation was not found.")
}

export const getOntologyRelation = getOntologyRelationById

export async function getOntologyRelationsByModule(
  firstArg: string,
  secondArg?: string,
  db?: AnyDbClient
): Promise<OntologyRelation[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  let ontologyId: string | undefined
  let moduleId: string

  if (secondArg !== undefined) {
    ontologyId = firstArg
    moduleId = secondArg
  } else {
    moduleId = firstArg
  }

  let snapshot: CanonicalOntologySnapshot | null = null

  if (ontologyId) {
    await assertOntologyDocumentAccess(ontologyId, database)
    snapshot = await loadCanonicalOntology(ontologyId, database)
  } else {
    const docs = (await database.select().from(ontologyDocuments)) as Array<
      typeof ontologyDocuments.$inferSelect
    >

    for (const doc of docs) {
      if (doc.linkml_yaml && doc.linkml_yaml.includes(moduleId)) {
        try {
          const s = await loadCanonicalOntology(doc.id, database)
          const hasModule =
            s.modules?.some((m) => m.id === moduleId) ||
            s.classes?.some((c) => c.module_id === moduleId)
          if (hasModule) {
            await assertOntologyDocumentAccess(doc.id, database)
            snapshot = s
            break
          }
        } catch {
          // Continue searching
        }
      }
    }
  }

  if (!snapshot) return []

  const moduleClasses = (snapshot.classes ?? []).filter(
    (c) => c.module_id === moduleId
  )
  if (moduleClasses.length === 0) return []

  const classIds = new Set(moduleClasses.map((c) => c.id))

  return (snapshot.relations ?? [])
    .filter(
      (r) => classIds.has(r.domain_class_id) || classIds.has(r.range_class_id)
    )
    .map((r) => projectRelation(r, snapshot!))
    .sort((a, b) => a.name.localeCompare(b.name))
}
