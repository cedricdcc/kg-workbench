"use server"

import { revalidatePath } from "next/cache"

import type { OntologyLocalizedText } from "@/domain/ontology"
import type { OntologyMetadataTarget } from "@/features/ontology/server/queries"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyLocalizedTextSnapshot } from "../linkml/types"

function projectLocalizedText(
  lt: OntologyLocalizedTextSnapshot,
  ontologyId: string
): OntologyLocalizedText {
  return {
    id: lt.id ?? `${ontologyId}-lt-${Date.now()}`,
    ontology_id: ontologyId,
    field_name: lt.field_name,
    language_code: lt.language_code,
    value: lt.value,
    target_ontology_id: lt.target_type === "ontology" ? lt.target_id : null,
    target_module_id: lt.target_type === "module" ? lt.target_id : null,
    target_class_id: lt.target_type === "class" ? lt.target_id : null,
    target_relation_id: lt.target_type === "relation" ? lt.target_id : null,
    target_attribute_id: lt.target_type === "attribute" ? lt.target_id : null,
    target_relation_attribute_id:
      lt.target_type === "relation_attribute" ? lt.target_id : null,
    target_cq_id: lt.target_type === "cq" ? lt.target_id : null,
  }
}

export async function upsertLocalizedText(
  ontologyId: string,
  target: OntologyMetadataTarget,
  fieldName: string,
  languageCode: string,
  value: string
): Promise<OntologyLocalizedText> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  let resultLt: OntologyLocalizedTextSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.localized_texts = draft.localized_texts ?? []
      const existing = draft.localized_texts.find(
        (lt) =>
          lt.target_type === target.type &&
          lt.target_id === target.id &&
          lt.field_name === fieldName &&
          lt.language_code === languageCode
      )

      if (existing) {
        existing.value = value
        resultLt = existing
      } else {
        const newLt: OntologyLocalizedTextSnapshot = {
          id: `lt-${Math.random().toString(36).slice(2, 9)}`,
          target_type: target.type,
          target_id: target.id,
          field_name: fieldName,
          language_code: languageCode,
          value,
        }
        draft.localized_texts.push(newLt)
        resultLt = newLt
      }
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return projectLocalizedText(
    resultLt ?? {
      target_type: target.type,
      target_id: target.id,
      field_name: fieldName,
      language_code: languageCode,
      value,
    },
    ontologyId
  )
}

export async function deleteLocalizedText(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_localized_texts", id, db))

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.localized_texts = (draft.localized_texts ?? []).filter(
        (lt) => lt.id !== id
      )
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
