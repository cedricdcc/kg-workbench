"use server"

import { revalidatePath } from "next/cache"

import type { OntologyNote } from "@/domain/ontology"
import type { OntologyMetadataTarget } from "@/features/ontology/server/queries"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyNoteSnapshot } from "../linkml/types"

function projectNote(
  note: OntologyNoteSnapshot,
  ontologyId: string
): OntologyNote {
  return {
    id: note.id ?? `${ontologyId}-note-${Date.now()}`,
    ontology_id: ontologyId,
    body: note.body,
    author_name: note.author_name ?? "",
    sort_order: note.sort_order ?? 0,
    created_at: new Date(0).toISOString(),
    target_ontology_id: note.target_type === "ontology" ? note.target_id : null,
    target_module_id: note.target_type === "module" ? note.target_id : null,
    target_class_id: note.target_type === "class" ? note.target_id : null,
    target_relation_id: note.target_type === "relation" ? note.target_id : null,
    target_attribute_id:
      note.target_type === "attribute" ? note.target_id : null,
    target_relation_attribute_id:
      note.target_type === "relation_attribute" ? note.target_id : null,
    target_cq_id: note.target_type === "cq" ? note.target_id : null,
  }
}

export async function createNote(
  ontologyId: string,
  target: OntologyMetadataTarget,
  body: string,
  authorName: string,
  sortOrder?: number
): Promise<OntologyNote> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const newNoteId = `note-${Math.random().toString(36).slice(2, 9)}`
  let created: OntologyNoteSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.notes = draft.notes ?? []
      created = {
        id: newNoteId,
        target_type: target.type,
        target_id: target.id,
        body,
        author_name: authorName,
        sort_order: sortOrder ?? 0,
      }
      draft.notes.push(created)
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return projectNote(
    created ?? {
      id: newNoteId,
      target_type: target.type,
      target_id: target.id,
      body,
      author_name: authorName,
      sort_order: sortOrder ?? 0,
    },
    ontologyId
  )
}

export async function updateNote(
  id: string,
  data: { body?: string; authorName?: string; sortOrder?: number },
  explicitOntologyId?: string
): Promise<OntologyNote> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_notes", id, db))

  let targetNote: OntologyNoteSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetNote = draft.notes?.find((n) => n.id === id)
      if (!targetNote) {
        throw new Error("Ontology note was not found.")
      }

      if (data.body !== undefined) targetNote.body = data.body
      if (data.authorName !== undefined)
        targetNote.author_name = data.authorName
      if (data.sortOrder !== undefined) targetNote.sort_order = data.sortOrder
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return projectNote(
    targetNote ?? {
      id,
      target_type: "ontology",
      target_id: ontologyId,
      body: data.body ?? "",
    },
    ontologyId
  )
}

export async function deleteNote(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_notes", id, db))

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.notes = (draft.notes ?? []).filter((n) => n.id !== id)
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
