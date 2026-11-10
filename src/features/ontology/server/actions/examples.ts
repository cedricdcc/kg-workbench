"use server"

import { revalidatePath } from "next/cache"

import type { OntologyExample } from "@/domain/ontology"
import type { OntologyExampleTarget } from "@/features/ontology/server/queries"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyExampleSnapshot } from "../linkml/types"

function projectExample(
  ex: OntologyExampleSnapshot,
  ontologyId: string
): OntologyExample {
  return {
    id: ex.id ?? `${ontologyId}-ex-${Date.now()}`,
    ontology_id: ontologyId,
    value: ex.value,
    subject_label: ex.subject_label ?? null,
    predicate_label: ex.predicate_label ?? null,
    object_label: ex.object_label ?? null,
    sort_order: ex.sort_order ?? 0,
    created_at: new Date(0).toISOString(),
    is_instance_candidate: Boolean(ex.is_instance_candidate),
    target_class_id: ex.target_type === "class" ? ex.target_id : null,
    target_attribute_id: ex.target_type === "attribute" ? ex.target_id : null,
    target_relation_id: ex.target_type === "relation" ? ex.target_id : null,
    target_relation_attribute_id:
      ex.target_type === "relation_attribute" ? ex.target_id : null,
    target_cq_id: ex.target_type === "cq" ? ex.target_id : null,
  }
}

export async function createExample(
  ontologyId: string,
  target: OntologyExampleTarget,
  data: {
    value: string
    subjectLabel?: string | null
    predicateLabel?: string | null
    objectLabel?: string | null
    isInstanceCandidate?: boolean
    sortOrder?: number
  }
): Promise<OntologyExample> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const newExId = `ex-${Math.random().toString(36).slice(2, 9)}`
  let created: OntologyExampleSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.examples = draft.examples ?? []
      created = {
        id: newExId,
        target_type: target.type,
        target_id: target.id,
        value: data.value,
        subject_label: data.subjectLabel ?? null,
        predicate_label: data.predicateLabel ?? null,
        object_label: data.objectLabel ?? null,
        is_instance_candidate: data.isInstanceCandidate ?? false,
        sort_order: data.sortOrder ?? 0,
      }
      draft.examples.push(created)
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return projectExample(
    created ?? {
      id: newExId,
      target_type: target.type,
      target_id: target.id,
      value: data.value,
      subject_label: data.subjectLabel ?? null,
      predicate_label: data.predicateLabel ?? null,
      object_label: data.objectLabel ?? null,
      is_instance_candidate: data.isInstanceCandidate ?? false,
      sort_order: data.sortOrder ?? 0,
    },
    ontologyId
  )
}

export async function updateExample(
  id: string,
  data: {
    value?: string
    subjectLabel?: string | null
    predicateLabel?: string | null
    objectLabel?: string | null
    isInstanceCandidate?: boolean
    sortOrder?: number
  },
  explicitOntologyId?: string
): Promise<OntologyExample> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_examples", id, db))

  let targetEx: OntologyExampleSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetEx = draft.examples?.find((e) => e.id === id)
      if (!targetEx) {
        throw new Error("Example not found.")
      }

      if (data.value !== undefined) targetEx.value = data.value
      if (data.subjectLabel !== undefined)
        targetEx.subject_label = data.subjectLabel
      if (data.predicateLabel !== undefined)
        targetEx.predicate_label = data.predicateLabel
      if (data.objectLabel !== undefined)
        targetEx.object_label = data.objectLabel
      if (data.isInstanceCandidate !== undefined)
        targetEx.is_instance_candidate = data.isInstanceCandidate
      if (data.sortOrder !== undefined) targetEx.sort_order = data.sortOrder
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return projectExample(
    targetEx ?? {
      id,
      target_type: "class",
      target_id: "",
      value: data.value ?? "",
    },
    ontologyId
  )
}

export async function deleteExample(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_examples", id, db))

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.examples = (draft.examples ?? []).filter((e) => e.id !== id)
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
