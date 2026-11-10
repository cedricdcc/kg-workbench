"use server"

import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type {
  CanonicalOntologySnapshot,
  OntologyClassSnapshot,
} from "../linkml/types"
import type { OntologyClassWithAttributes } from "./types"

function projectClassWithAttributes(
  cls: OntologyClassSnapshot,
  snapshot: CanonicalOntologySnapshot
): OntologyClassWithAttributes {
  const snapshotAttrs = snapshot.attributes ?? []
  type CandidateAttr = {
    id: string
    name: string
    data_type?: string
    required?: boolean
    description?: string
  }
  const rawAttrs =
    snapshotAttrs.length > 0
      ? snapshotAttrs.filter((attr) => attr.class_id === cls.id)
      : (((cls as unknown as { attributes?: CandidateAttr[] }).attributes ??
          []) as CandidateAttr[])

  const clsAttrs = rawAttrs
    .map((attr) => ({
      id: attr.id,
      class_id: cls.id,
      name: attr.name,
      data_type: attr.data_type ?? "string",
      required: attr.required ?? false,
      description: attr.description ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    id: cls.id,
    ontology_id: snapshot.document.id,
    module_id: cls.module_id ?? null,
    name: cls.name,
    description: cls.description ?? "",
    parent_class_id: cls.parent_class_id ?? null,
    instance_policy: cls.instance_policy ?? "open",
    attributes: clsAttrs,
  }
}

export async function getOntologyClasses(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyClassWithAttributes[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.classes ?? [])
    .map((cls) => projectClassWithAttributes(cls, snapshot))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getOntologyClassById(
  firstArg: string,
  secondArg?: string,
  db?: AnyDbClient
): Promise<OntologyClassWithAttributes> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  let ontologyId: string | undefined
  let classId: string

  if (secondArg !== undefined) {
    ontologyId = firstArg
    classId = secondArg
  } else {
    classId = firstArg
  }

  if (ontologyId) {
    await assertOntologyDocumentAccess(ontologyId, database)
    const snapshot = await loadCanonicalOntology(ontologyId, database)
    const cls = snapshot.classes?.find((c) => c.id === classId)
    if (!cls) {
      throw new Error(`Class ${classId} not found.`)
    }
    return projectClassWithAttributes(cls, snapshot)
  }

  // If no ontologyId provided, find the document that defines this class
  const docs = (await database.select().from(ontologyDocuments)) as Array<
    typeof ontologyDocuments.$inferSelect
  >

  for (const doc of docs) {
    if (doc.linkml_yaml && doc.linkml_yaml.includes(classId)) {
      try {
        const snapshot = await loadCanonicalOntology(doc.id, database)
        const cls = snapshot.classes?.find((c) => c.id === classId)
        if (cls) {
          await assertOntologyDocumentAccess(doc.id, database)
          return projectClassWithAttributes(cls, snapshot)
        }
      } catch {
        // Continue searching
      }
    }
  }

  throw new Error(`Class ${classId} not found.`)
}

export const getOntologyClass = getOntologyClassById

export async function getOntologyClassesByModule(
  firstArg: string,
  secondArg?: string,
  db?: AnyDbClient
): Promise<OntologyClassWithAttributes[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  let ontologyId: string | undefined
  let moduleId: string

  if (secondArg !== undefined) {
    ontologyId = firstArg
    moduleId = secondArg
  } else {
    moduleId = firstArg
  }

  if (ontologyId) {
    await assertOntologyDocumentAccess(ontologyId, database)
    const snapshot = await loadCanonicalOntology(ontologyId, database)
    return (snapshot.classes ?? [])
      .filter((cls) => cls.module_id === moduleId)
      .map((cls) => projectClassWithAttributes(cls, snapshot))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // If no ontologyId provided, find the document containing this module
  const docs = (await database.select().from(ontologyDocuments)) as Array<
    typeof ontologyDocuments.$inferSelect
  >

  for (const doc of docs) {
    if (doc.linkml_yaml && doc.linkml_yaml.includes(moduleId)) {
      try {
        const snapshot = await loadCanonicalOntology(doc.id, database)
        const hasModule =
          snapshot.modules?.some((m) => m.id === moduleId) ||
          snapshot.classes?.some((c) => c.module_id === moduleId)
        if (hasModule) {
          await assertOntologyDocumentAccess(doc.id, database)
          return (snapshot.classes ?? [])
            .filter((cls) => cls.module_id === moduleId)
            .map((cls) => projectClassWithAttributes(cls, snapshot))
            .sort((a, b) => a.name.localeCompare(b.name))
        }
      } catch {
        // Continue searching
      }
    }
  }

  return []
}
