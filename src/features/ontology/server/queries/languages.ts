"use server"

import type { OntologyLanguage } from "@/domain/ontology"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
  ja: "Japanese",
  zh: "Chinese",
}

function getLanguageLabel(code: string): string {
  return LANGUAGE_LABELS[code.toLowerCase()] || code.toUpperCase()
}

export async function getOntologyLanguages(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyLanguage[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  const codes = new Set<string>()
  if (snapshot.document.default_language) {
    codes.add(snapshot.document.default_language)
  } else {
    codes.add("en")
  }

  if (Array.isArray(snapshot.localized_texts)) {
    for (const lt of snapshot.localized_texts) {
      if (lt.language_code) {
        codes.add(lt.language_code)
      }
    }
  }

  return Array.from(codes)
    .sort()
    .map((code) => ({
      id: `${ontologyId}-${code}`,
      ontology_id: ontologyId,
      language_code: code,
      label: getLanguageLabel(code),
    }))
}
