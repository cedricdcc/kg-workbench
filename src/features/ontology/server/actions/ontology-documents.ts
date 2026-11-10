"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import type { OntologyDocument } from "@/domain/ontology"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  getCurrentGroupKeyOrThrow,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import { compileSnapshotArtifacts } from "../linkml/compiler"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { CanonicalOntologySnapshot } from "../linkml/types"

export async function createOntologyDocument(fields: {
  defaultLanguage: string
  defaultLanguageLabel?: string
  name: string
  usecase?: string
}): Promise<OntologyDocument> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const initialSnapshot: CanonicalOntologySnapshot = {
    document: {
      id: "temp",
      name: fields.name,
      version: "1.0.0",
      default_language: fields.defaultLanguage,
      usecase: fields.usecase ?? "",
      group_key: groupKey,
    },
    modules: [],
    classes: [],
    attributes: [],
    relations: [],
    relation_attributes: [],
    restrictions: [],
    disjointness: [],
    notes: [],
    examples: [],
    localized_texts: [],
    ui_layout: { classPositions: {}, moduleLayouts: {} },
  }

  const compiled = compileSnapshotArtifacts(initialSnapshot)

  const [data] = await db
    .insert(ontologyDocuments)
    .values({
      default_language: fields.defaultLanguage,
      group_key: groupKey,
      name: fields.name,
      usecase: fields.usecase ?? "",
      linkml_yaml: compiled.linkmlYaml,
      ui_layout: { classPositions: {}, moduleLayouts: {} },
      compiled_artifacts: compiled.artifacts,
    })
    .returning()
  if (!data) throw new Error("Failed to create ontology document.")

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // revalidatePath might not be available in non-Next environments
  }
  return data
}

export async function updateOntologyDocument(
  id: string,
  fields: { name?: string; usecase?: string; defaultLanguage?: string }
): Promise<OntologyDocument> {
  const db = getDb()
  await assertOntologyDocumentAccess(id, db)

  await saveCanonicalOntology(
    id,
    (draft) => {
      if (fields.name !== undefined) draft.document.name = fields.name
      if (fields.usecase !== undefined) draft.document.usecase = fields.usecase
      if (fields.defaultLanguage !== undefined)
        draft.document.default_language = fields.defaultLanguage
    },
    { db }
  )

  const [data] = await db
    .select()
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, id))
  if (!data) throw new Error("Ontology document was not found.")

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
  return data
}

export async function deleteOntologyDocument(id: string): Promise<void> {
  const db = getDb()
  await assertOntologyDocumentAccess(id, db)
  await db.delete(ontologyDocuments).where(eq(ontologyDocuments.id, id))
  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
