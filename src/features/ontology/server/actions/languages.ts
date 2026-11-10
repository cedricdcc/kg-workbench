"use server"

import { revalidatePath } from "next/cache"

import type { OntologyLanguage } from "@/domain/ontology"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"

export async function createLanguage(
  ontologyId: string,
  languageCode: string,
  label: string
): Promise<OntologyLanguage> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const code = languageCode.trim().toLowerCase()

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      if (!draft.document.default_language) {
        draft.document.default_language = code
      }
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return {
    id: `${ontologyId}-${code}`,
    ontology_id: ontologyId,
    language_code: code,
    label: label || code,
  }
}

export async function updateLanguage(
  id: string,
  label: string,
  explicitOntologyId?: string
): Promise<OntologyLanguage> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_languages", id, db))

  const parts = id.split("-")
  const code = parts[parts.length - 1] || "en"

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return {
    id,
    ontology_id: ontologyId,
    language_code: code,
    label,
  }
}

export async function deleteLanguage(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_languages", id, db))

  const parts = id.split("-")
  const code = parts[parts.length - 1]

  if (code) {
    await saveCanonicalOntology(
      ontologyId,
      (draft) => {
        draft.localized_texts = (draft.localized_texts ?? []).filter(
          (lt) => lt.language_code.toLowerCase() !== code.toLowerCase()
        )
      },
      { db }
    )
  }

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
