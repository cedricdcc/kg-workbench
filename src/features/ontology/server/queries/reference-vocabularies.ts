"use server"

import { desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/server/database"
import { referenceOntologies, referenceOntologyTerms } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"

export type ReferenceOntologySummary = {
  id: string
  prefix: string
  name: string
  baseIri: string
  sourceRegistry: string
  sourceId: string
  version: string | null
  syncedAt: string | null
  termCount: number
}

export async function getReferenceOntologies(): Promise<ReferenceOntologySummary[]> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const rows = await db
    .select()
    .from(referenceOntologies)
    .where(eq(referenceOntologies.group_key, groupKey))
    .orderBy(desc(referenceOntologies.created_at))

  if (rows.length === 0) return []

  const termCounts = await Promise.all(
    rows.map(async (row) => {
      const terms = await db
        .select({ id: referenceOntologyTerms.id })
        .from(referenceOntologyTerms)
        .where(eq(referenceOntologyTerms.reference_ontology_id, row.id))
      return {
        id: row.id,
        prefix: row.prefix,
        name: row.name,
        baseIri: row.base_iri,
        sourceRegistry: row.source_registry,
        sourceId: row.source_id,
        version: row.version,
        syncedAt: row.synced_at,
        termCount: terms.length,
      }
    })
  )

  return termCounts
}

export async function getActiveReferenceTerms(
  ontologyIds?: string[]
): Promise<Array<{
  id: string
  referenceOntologyId: string
  curie: string
  iri: string
  label: string
  type: string
  description: string
  synonyms: string[]
  parentIris: string[]
  relatedPropertyIris: string[]
  embedding: number[] | null
}>> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  let query = db
    .select()
    .from(referenceOntologyTerms)
    .where(eq(referenceOntologyTerms.group_key, groupKey))

  if (ontologyIds && ontologyIds.length > 0) {
    query = db
      .select()
      .from(referenceOntologyTerms)
      .where(inArray(referenceOntologyTerms.reference_ontology_id, ontologyIds))
  }

  const rows = await query
  return rows.map((r) => ({
    id: r.id,
    referenceOntologyId: r.reference_ontology_id,
    curie: r.curie,
    iri: r.iri,
    label: r.label,
    type: r.type,
    description: r.description,
    synonyms: r.synonyms || [],
    parentIris: r.parent_iris || [],
    relatedPropertyIris: r.related_property_iris || [],
    embedding: r.embedding,
  }))
}
