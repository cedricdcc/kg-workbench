import { and, eq, ilike } from "drizzle-orm"
import type { ExtractionResultsResponse } from "@/server/external/extraction-api"
import { getDb } from "@/server/database"
import {
  documentEntities,
  documentParagraphs,
  documentSections,
  entityAttributeValues,
  evidenceAnchors,
  extractionRuns,
  factAnchors,
  facts,
} from "@/server/db/schema"
import { loadCanonicalOntology } from "@/features/ontology/server/linkml/document-store"
import type { CanonicalOntologySnapshot } from "@/features/ontology/server/linkml/types"

const norm = (value: string) => value.trim().toLowerCase()

export type OntologySymbolLookup = {
  classIdByKey: Map<string, string>
  classNameById: Map<string, string>
  relationIdByExactName: Map<string, string>
  relationIdByKey: Map<string, string>
  attributeIdsByClassId: Map<string, Map<string, string>>
}

/**
 * Builds an in-memory lookup table for resolving LinkML symbol keys
 * (`classKey`, `relationKey`, `"ClassKey.attrName"`, or `attrName`) and
 * legacy display names to canonical ontology UUIDs.
 */
export function buildOntologySymbolLookup(
  snapshot: CanonicalOntologySnapshot
): OntologySymbolLookup {
  const classes = snapshot.classes ?? []
  const relations = snapshot.relations ?? []
  const attributes = snapshot.attributes ?? []

  const classIdByKey = new Map<string, string>()
  const classNameById = new Map<string, string>()
  for (const cls of classes) {
    classNameById.set(cls.id, cls.name)
    classIdByKey.set(norm(cls.name), cls.id)
    classIdByKey.set(cls.id, cls.id)
  }

  const relationIdByExactName = new Map<string, string>()
  const relationIdByKey = new Map<string, string>()
  for (const rel of relations) {
    relationIdByExactName.set(rel.name, rel.id)
    relationIdByKey.set(norm(rel.name), rel.id)
    relationIdByKey.set(rel.id, rel.id)
  }

  const attributeIdsByClassId = new Map<string, Map<string, string>>()
  for (const attribute of attributes) {
    const values =
      attributeIdsByClassId.get(attribute.class_id) ??
      new Map<string, string>()
    const attrKey = norm(attribute.name)
    values.set(attrKey, attribute.id)
    const className = classNameById.get(attribute.class_id)
    if (className) {
      values.set(`${norm(className)}.${attrKey}`, attribute.id)
    }
    attributeIdsByClassId.set(attribute.class_id, values)
  }

  return {
    classIdByKey,
    classNameById,
    relationIdByExactName,
    relationIdByKey,
    attributeIdsByClassId,
  }
}

export function resolveClassId(
  lookup: OntologySymbolLookup,
  classKey: string | null | undefined
): string | null {
  if (!classKey) return null
  const trimmed = classKey.trim()
  if (!trimmed) return null
  return lookup.classIdByKey.get(norm(trimmed)) ?? lookup.classIdByKey.get(trimmed) ?? null
}

export function resolveRelationId(
  lookup: OntologySymbolLookup,
  relationKey: string | null | undefined
): string | null {
  if (!relationKey) return null
  const trimmed = relationKey.trim()
  if (!trimmed) return null
  return (
    lookup.relationIdByExactName.get(trimmed) ??
    lookup.relationIdByKey.get(norm(trimmed)) ??
    lookup.relationIdByKey.get(trimmed) ??
    null
  )
}

export function resolveAttributeId(
  lookup: OntologySymbolLookup,
  classId: string | null | undefined,
  attributeKey: string | null | undefined
): string | null {
  if (!classId || !attributeKey) return null
  const trimmed = attributeKey.trim()
  if (!trimmed) return null
  return lookup.attributeIdsByClassId.get(classId)?.get(norm(trimmed)) ?? null
}

export function resolveSymbolIds(
  lookup: OntologySymbolLookup,
  keys: {
    classKey?: string | null
    relationKey?: string | null
    attributeKey?: string | null
  }
): {
  classId: string | null
  relationId: string | null
  attributeId: string | null
} {
  const classId = resolveClassId(lookup, keys.classKey)
  return {
    classId,
    relationId: resolveRelationId(lookup, keys.relationKey),
    attributeId: resolveAttributeId(lookup, classId, keys.attributeKey),
  }
}

export async function persistExtractionResults(
  runId: string,
  results: ExtractionResultsResponse,
  documentId: string
): Promise<void> {
  const db = getDb()
  const [run] = await db
    .select({ ontology_id: extractionRuns.ontology_id })
    .from(extractionRuns)
    .where(eq(extractionRuns.id, runId))
    .limit(1)
  if (!run?.ontology_id)
    throw new Error("Extraction run has no associated ontology")
  const snapshot = await loadCanonicalOntology(run.ontology_id, db)
  const symbolLookup = buildOntologySymbolLookup(snapshot)
  const inferredClass = new Map<string, string>()
  for (const fact of results.facts) {
    if (!inferredClass.has(fact.object_temp_id))
      inferredClass.set(fact.object_temp_id, fact.objectClassName)
    if (!inferredClass.has(fact.subject_temp_id))
      inferredClass.set(fact.subject_temp_id, fact.subjectClassName)
  }
  const paragraphIds = new Map<string, string>()
  const sectionIds = new Map<string, string>()
  for (const [sectionIndex, section] of results.sections.entries()) {
    const [sectionRow] = await db
      .insert(documentSections)
      .values({
        document_id: documentId,
        title: section.title,
        sort_order: sectionIndex,
        summary: "",
      })
      .returning()
    if (!sectionRow) throw new Error("Could not save section.")
    for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
      const [paragraphRow] = await db
        .insert(documentParagraphs)
        .values({
          section_id: sectionRow.id,
          content: paragraph.content,
          sort_order: paragraphIndex,
        })
        .returning()
      if (!paragraphRow) throw new Error("Could not save paragraph.")
      paragraphIds.set(paragraph.id, paragraphRow.id)
      sectionIds.set(paragraphRow.id, sectionRow.id)
    }
  }
  const entityIds = new Map<string, string>()
  for (const entity of results.entities) {
    const className =
        entity.className?.trim() || inferredClass.get(entity.temp_id)?.trim(),
      classId = resolveClassId(symbolLookup, className)
    const [existing] = await db
      .select({ id: documentEntities.id, class_id: documentEntities.class_id })
      .from(documentEntities)
      .where(
        and(
          eq(documentEntities.document_id, documentId),
          ilike(documentEntities.entity_text, entity.text)
        )
      )
      .limit(1)
    let entityId: string,
      persistedClassId = classId
    if (existing) {
      entityId = existing.id
      if (!existing.class_id && classId)
        await db
          .update(documentEntities)
          .set({ class_id: classId })
          .where(eq(documentEntities.id, entityId))
      else if (existing.class_id && classId && existing.class_id !== classId)
        console.warn(
          `Conflicting classes for entity "${entity.text}": keeping "${symbolLookup.classNameById.get(existing.class_id) ?? existing.class_id}" instead of "${className}"`
        )
      persistedClassId = existing.class_id ?? classId
    } else {
      const [row] = await db
        .insert(documentEntities)
        .values({
          document_id: documentId,
          entity_text: entity.text,
          extraction_run_id: runId,
          class_id: classId,
        })
        .returning()
      if (!row) throw new Error("Could not save entity.")
      entityId = row.id
    }
    entityIds.set(entity.temp_id, entityId)
    if (!persistedClassId) {
      console.warn(
        `Could not resolve a class for entity "${entity.text}"; attribute values were skipped`
      )
      continue
    }
    for (const attribute of entity.attributes) {
      const id = resolveAttributeId(
        symbolLookup,
        persistedClassId,
        attribute.attribute_name
      )
      if (!id) {
        console.warn(
          `Unrecognized attribute "${attribute.attribute_name}" for entity "${entity.text}" - skipping`
        )
        continue
      }
      await db
        .insert(entityAttributeValues)
        .values({
          entity_id: entityId,
          attribute_id: id,
          value: attribute.value,
        })
        .onConflictDoUpdate({
          target: [
            entityAttributeValues.entity_id,
            entityAttributeValues.attribute_id,
          ],
          set: { value: attribute.value },
        })
    }
  }
  const textByTempId = new Map(
    results.entities.map((entity) => [entity.temp_id, entity.text])
  )
  for (const fact of results.facts) {
    let anchorId: string | null = null
    if (fact.evidence) {
      const paragraphId = fact.evidence.paragraphId
        ? (paragraphIds.get(fact.evidence.paragraphId) ?? null)
        : null
      const [anchor] = await db
        .insert(evidenceAnchors)
        .values({
          document_id: documentId,
          quote_text: fact.evidence.quote,
          context_text: fact.evidence.sectionTitle,
          paragraph_id: paragraphId,
          section_id: paragraphId
            ? (sectionIds.get(paragraphId) ?? null)
            : null,
          page_from: fact.evidence.pageFrom ?? null,
          page_to: fact.evidence.pageTo ?? null,
        })
        .returning()
      if (!anchor) throw new Error("Could not save evidence anchor.")
      anchorId = anchor.id
    }
    const [row] = await db
      .insert(facts)
      .values({
        extraction_run_id: runId,
        document_id: documentId,
        subject_text: textByTempId.get(fact.subject_temp_id) ?? "",
        relation_text: fact.relation_text,
        object_text: textByTempId.get(fact.object_temp_id) ?? "",
        subject_entity_id: entityIds.get(fact.subject_temp_id) ?? null,
        object_entity_id: entityIds.get(fact.object_temp_id) ?? null,
        relation_type_id: resolveRelationId(symbolLookup, fact.relationName),
        confidence: fact.confidence,
        is_cross_chapter: fact.isCrossChapter ?? false,
        primary_anchor_id: anchorId,
      })
      .returning()
    if (!row) throw new Error("Could not save fact.")
    if (anchorId)
      await db
        .insert(factAnchors)
        .values({ fact_id: row.id, anchor_id: anchorId })
  }
}
