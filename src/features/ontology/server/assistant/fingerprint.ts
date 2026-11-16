import "server-only"

import crypto from "node:crypto"
import { and, asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/server/database"
import {
  ontologyCompetencyQuestions,
  ontologyCqTriples,
  ontologyDocuments,
} from "@/server/db/schema"
import { runWithGroupKey } from "@/server/group-access"

export interface FingerprintCqTriple {
  id: string
  sortOrder: number
  subjectClassId: string | null
  predicateRelationId: string | null
  objectClassId: string | null
}

export interface FingerprintCqEntry {
  id: string
  question: string
  sortOrder: number
  subjectClassId: string | null
  predicateRelationId: string | null
  objectClassId: string | null
  triples: FingerprintCqTriple[]
}

export interface OntologyFingerprintInput {
  linkmlYaml: string
  uiLayout: unknown
  cqs: FingerprintCqEntry[]
}

export interface OntologyFingerprintDeps {
  loadFingerprintInput?: (
    ontologyId: string,
    groupKey: string
  ) => Promise<OntologyFingerprintInput>
}

export function hashFingerprintPayload(
  payload: OntologyFingerprintInput
): string {
  const canonical = {
    linkmlYaml: payload.linkmlYaml,
    uiLayout: payload.uiLayout,
    cqs: [...payload.cqs]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .map((cq) => ({
        id: cq.id,
        question: cq.question,
        sortOrder: cq.sortOrder,
        subjectClassId: cq.subjectClassId,
        predicateRelationId: cq.predicateRelationId,
        objectClassId: cq.objectClassId,
        triples: [...cq.triples]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
          .map((t) => ({
            id: t.id,
            sortOrder: t.sortOrder,
            subjectClassId: t.subjectClassId,
            predicateRelationId: t.predicateRelationId,
            objectClassId: t.objectClassId,
          })),
      })),
  }

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
}

async function loadFromDatabase(
  ontologyId: string,
  groupKey: string
): Promise<OntologyFingerprintInput> {
  const db = getDb()

  const [doc] = await db
    .select({
      id: ontologyDocuments.id,
      linkml_yaml: ontologyDocuments.linkml_yaml,
      ui_layout: ontologyDocuments.ui_layout,
    })
    .from(ontologyDocuments)
    .where(
      and(
        eq(ontologyDocuments.id, ontologyId),
        eq(ontologyDocuments.group_key, groupKey)
      )
    )
    .limit(1)

  if (!doc) {
    throw new Error(
      "Ontology document is not accessible for the current group."
    )
  }

  const cqRows = await db
    .select({
      id: ontologyCompetencyQuestions.id,
      question: ontologyCompetencyQuestions.question,
      sort_order: ontologyCompetencyQuestions.sort_order,
      subject_class_id: ontologyCompetencyQuestions.subject_class_id,
      predicate_relation_id: ontologyCompetencyQuestions.predicate_relation_id,
      object_class_id: ontologyCompetencyQuestions.object_class_id,
    })
    .from(ontologyCompetencyQuestions)
    .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))
    .orderBy(
      asc(ontologyCompetencyQuestions.sort_order),
      asc(ontologyCompetencyQuestions.id)
    )

  const cqIds = cqRows.map((row) => row.id)
  const triplesByCq = new Map<string, FingerprintCqTriple[]>()

  if (cqIds.length > 0) {
    const tripleRows = await db
      .select({
        id: ontologyCqTriples.id,
        cq_id: ontologyCqTriples.cq_id,
        sort_order: ontologyCqTriples.sort_order,
        subject_class_id: ontologyCqTriples.subject_class_id,
        predicate_relation_id: ontologyCqTriples.predicate_relation_id,
        object_class_id: ontologyCqTriples.object_class_id,
      })
      .from(ontologyCqTriples)
      .where(inArray(ontologyCqTriples.cq_id, cqIds))
      .orderBy(
        asc(ontologyCqTriples.cq_id),
        asc(ontologyCqTriples.sort_order),
        asc(ontologyCqTriples.id)
      )

    for (const triple of tripleRows) {
      const list = triplesByCq.get(triple.cq_id) ?? []
      list.push({
        id: triple.id,
        sortOrder: triple.sort_order,
        subjectClassId: triple.subject_class_id,
        predicateRelationId: triple.predicate_relation_id,
        objectClassId: triple.object_class_id,
      })
      triplesByCq.set(triple.cq_id, list)
    }
  }

  return {
    linkmlYaml: doc.linkml_yaml,
    uiLayout: doc.ui_layout,
    cqs: cqRows.map((row) => ({
      id: row.id,
      question: row.question,
      sortOrder: row.sort_order,
      subjectClassId: row.subject_class_id,
      predicateRelationId: row.predicate_relation_id,
      objectClassId: row.object_class_id,
      triples: triplesByCq.get(row.id) ?? [],
    })),
  }
}

/**
 * Computes a deterministic SHA-256 fingerprint over linkml_yaml, ui_layout,
 * and ordered CQ IDs, questions, and SPO triples for the given ontology.
 */
export async function computeOntologyFingerprint(
  ontologyId: string,
  groupKey: string,
  deps?: OntologyFingerprintDeps
): Promise<{ fingerprint: string }> {
  return runWithGroupKey(groupKey, async () => {
    const payload = deps?.loadFingerprintInput
      ? await deps.loadFingerprintInput(ontologyId, groupKey)
      : await loadFromDatabase(ontologyId, groupKey)

    return {
      fingerprint: hashFingerprintPayload(payload),
    }
  })
}
