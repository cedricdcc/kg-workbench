import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { cookies } from "next/headers"

import {
  type AppAccessGroup,
  getAppAccessCookie,
  getAppAccessGroupCookie,
  getCurrentAppAccessGroup,
} from "@/lib/app-access"
import { getDb } from "@/server/database"
import {
  documentEntities,
  documentParagraphs,
  documentSections,
  documents,
  entityAttributeValues,
  evidenceAnchors,
  extractionRuns,
  factRelationAttributeValues,
  facts,
  ontologyCompetencyQuestions,
  ontologyDocuments,
} from "@/server/db/schema"

type ServerDb = ReturnType<typeof getDb>

type OntologyScopedRecord =
  | "ontology_documents"
  | "ontology_modules"
  | "ontology_classes"
  | "ontology_attributes"
  | "ontology_relations"
  | "ontology_relation_attributes"
  | "ontology_competency_questions"
  | "ontology_languages"
  | "ontology_notes"
  | "ontology_localized_texts"
  | "ontology_examples"
  | "ontology_module_layout"
  | "ontology_class_positions"

type DocumentScopedRecord =
  | "documents"
  | "document_sections"
  | "document_paragraphs"
  | "extraction_runs"
  | "document_entities"
  | "entity_attribute_values"
  | "evidence_anchors"
  | "facts"
  | "fact_relation_attribute_values"

function throwAccessDenied(message: string): never {
  throw new Error(message)
}

export async function getCurrentGroupOrThrow(): Promise<AppAccessGroup> {
  let cookieVal: string | undefined
  let groupVal: string | undefined
  try {
    const cookieStore = await cookies()
    cookieVal = cookieStore.get(getAppAccessCookie().name)?.value
    groupVal = cookieStore.get(getAppAccessGroupCookie().name)?.value
  } catch {
    // cookies() is unavailable outside Next.js request scope (e.g. unit tests or scripts)
  }
  const group = await getCurrentAppAccessGroup(cookieVal, groupVal)

  if (!group) throwAccessDenied("No valid app access group is active.")
  return group
}

export async function getCurrentGroupKeyOrThrow(): Promise<string> {
  return (await getCurrentGroupOrThrow()).key
}

export async function assertOntologyDocumentAccess(
  ontologyId: string,
  db: ServerDb = getDb()
): Promise<string> {
  const groupKey = await getCurrentGroupKeyOrThrow()
  const [row] = await db
    .select({ id: ontologyDocuments.id })
    .from(ontologyDocuments)
    .where(
      and(
        eq(ontologyDocuments.id, ontologyId),
        eq(ontologyDocuments.group_key, groupKey)
      )
    )
    .limit(1)

  if (!row) {
    throwAccessDenied(
      "Ontology document is not accessible for the current group."
    )
  }
  return ontologyId
}

export async function assertDocumentAccess(
  documentId: string,
  db: ServerDb = getDb()
): Promise<string> {
  const groupKey = await getCurrentGroupKeyOrThrow()
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.group_key, groupKey)))
    .limit(1)

  if (!row)
    throwAccessDenied("Document is not accessible for the current group.")
  return documentId
}

async function resolveOntologyIdForRecord(
  recordType: OntologyScopedRecord,
  id: string,
  db: ServerDb
): Promise<string | null> {
  if (recordType === "ontology_documents") {
    return id
  }
  if (recordType === "ontology_competency_questions") {
    const [row] = await db
      .select({ ontology_id: ontologyCompetencyQuestions.ontology_id })
      .from(ontologyCompetencyQuestions)
      .where(eq(ontologyCompetencyQuestions.id, id))
      .limit(1)
    return row?.ontology_id ?? null
  }

  // Check if id directly matches an ontology document
  const [directDoc] = await db
    .select({ id: ontologyDocuments.id })
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, id))
    .limit(1)
  if (directDoc) {
    return directDoc.id
  }

  // Otherwise, search ontology documents where linkml_yaml or ui_layout contains the symbol key
  const docs = (await db
    .select({
      id: ontologyDocuments.id,
      linkml_yaml: ontologyDocuments.linkml_yaml,
      ui_layout: ontologyDocuments.ui_layout,
    })
    .from(ontologyDocuments)) as Array<{
    id: string
    linkml_yaml: string | null
    ui_layout: unknown
  }>

  for (const row of docs) {
    if (row.linkml_yaml && row.linkml_yaml.includes(id)) {
      return row.id
    }
    if (row.ui_layout) {
      const layoutStr = JSON.stringify(row.ui_layout)
      if (layoutStr.includes(id)) {
        return row.id
      }
    }
  }

  return null
}

async function selectDocumentId(
  db: ServerDb,
  table:
    | typeof documentSections
    | typeof extractionRuns
    | typeof documentEntities
    | typeof evidenceAnchors
    | typeof facts,
  id: string
): Promise<string | null> {
  const [row] = await db
    .select({ document_id: table.document_id })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
  return row?.document_id ?? null
}

async function resolveDocumentIdForRecord(
  recordType: DocumentScopedRecord,
  id: string,
  db: ServerDb
): Promise<string | null> {
  switch (recordType) {
    case "documents":
      return id
    case "document_sections":
      return selectDocumentId(db, documentSections, id)
    case "extraction_runs":
      return selectDocumentId(db, extractionRuns, id)
    case "document_entities":
      return selectDocumentId(db, documentEntities, id)
    case "evidence_anchors":
      return selectDocumentId(db, evidenceAnchors, id)
    case "facts":
      return selectDocumentId(db, facts, id)
    case "document_paragraphs": {
      const [row] = await db
        .select({ document_id: documentSections.document_id })
        .from(documentParagraphs)
        .innerJoin(
          documentSections,
          eq(documentParagraphs.section_id, documentSections.id)
        )
        .where(eq(documentParagraphs.id, id))
        .limit(1)
      return row?.document_id ?? null
    }
    case "entity_attribute_values": {
      const [row] = await db
        .select({ document_id: documentEntities.document_id })
        .from(entityAttributeValues)
        .innerJoin(
          documentEntities,
          eq(entityAttributeValues.entity_id, documentEntities.id)
        )
        .where(eq(entityAttributeValues.id, id))
        .limit(1)
      return row?.document_id ?? null
    }
    case "fact_relation_attribute_values": {
      const [row] = await db
        .select({ document_id: facts.document_id })
        .from(factRelationAttributeValues)
        .innerJoin(facts, eq(factRelationAttributeValues.fact_id, facts.id))
        .where(eq(factRelationAttributeValues.id, id))
        .limit(1)
      return row?.document_id ?? null
    }
  }
}

export async function assertOntologyRecordAccess(
  recordType: OntologyScopedRecord,
  id: string,
  db: ServerDb = getDb(),
  ontologyId?: string
): Promise<string> {
  const targetOntologyId =
    ontologyId ?? (await resolveOntologyIdForRecord(recordType, id, db))
  if (!targetOntologyId) {
    const [doc] = await db
      .select({ id: ontologyDocuments.id })
      .from(ontologyDocuments)
      .where(eq(ontologyDocuments.id, id))
      .limit(1)
    if (doc) {
      await assertOntologyDocumentAccess(doc.id, db)
      return doc.id
    }
    throwAccessDenied(
      "Ontology record is not accessible for the current group."
    )
  }
  await assertOntologyDocumentAccess(targetOntologyId, db)
  return targetOntologyId
}

export async function assertDocumentRecordAccess(
  recordType: DocumentScopedRecord,
  id: string,
  db: ServerDb = getDb()
): Promise<string> {
  const documentId = await resolveDocumentIdForRecord(recordType, id, db)
  if (!documentId) {
    throwAccessDenied(
      "Document record is not accessible for the current group."
    )
  }
  await assertDocumentAccess(documentId, db)
  return documentId
}

export async function getAccessibleOntologyIds(
  ontologyIds: string[],
  db: ServerDb = getDb()
): Promise<string[]> {
  if (ontologyIds.length === 0) return []
  const groupKey = await getCurrentGroupKeyOrThrow()
  const rows = await db
    .select({ id: ontologyDocuments.id })
    .from(ontologyDocuments)
    .where(
      and(
        inArray(ontologyDocuments.id, ontologyIds),
        eq(ontologyDocuments.group_key, groupKey)
      )
    )
  return rows.map((row) => row.id)
}

export async function getAccessibleDocumentIds(
  documentIds: string[],
  db: ServerDb = getDb()
): Promise<string[]> {
  if (documentIds.length === 0) return []
  const groupKey = await getCurrentGroupKeyOrThrow()
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(inArray(documents.id, documentIds), eq(documents.group_key, groupKey))
    )
  return rows.map((row) => row.id)
}
