"use server"

import { asc, eq, or } from "drizzle-orm"
import type {
  OntologyCompetencyQuestion,
  OntologyExample,
  OntologyLocalizedText,
  OntologyNote,
} from "@/domain/ontology"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  ontologyCompetencyQuestions,
  ontologyDocuments,
} from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type {
  CanonicalOntologySnapshot,
  OntologyExampleSnapshot,
  OntologyLocalizedTextSnapshot,
  OntologyNoteSnapshot,
} from "../linkml/types"
import type {
  OntologyExampleCandidateTarget,
  OntologyExampleImpact,
  OntologyExampleImpactRole,
  OntologyExampleTarget,
  OntologyMetadataTarget,
} from "./types"

function projectNote(
  note: OntologyNoteSnapshot,
  ontologyId: string,
  index: number
): OntologyNote {
  return {
    id: note.id ?? `${ontologyId}-note-${index}`,
    ontology_id: ontologyId,
    body: note.body,
    author_name: note.author_name ?? "",
    sort_order: note.sort_order ?? index,
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

function projectLocalizedText(
  lt: OntologyLocalizedTextSnapshot,
  ontologyId: string,
  index: number
): OntologyLocalizedText {
  return {
    id: lt.id ?? `${ontologyId}-lt-${index}`,
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

function projectExample(
  ex: OntologyExampleSnapshot,
  ontologyId: string,
  index: number
): OntologyExample {
  return {
    id: ex.id ?? `${ontologyId}-ex-${index}`,
    ontology_id: ontologyId,
    value: ex.value,
    subject_label: ex.subject_label ?? null,
    predicate_label: ex.predicate_label ?? null,
    object_label: ex.object_label ?? null,
    sort_order: ex.sort_order ?? index,
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

async function resolveOntologySnapshotForTarget(
  target: OntologyMetadataTarget | OntologyExampleTarget,
  db: ReturnType<typeof getDb>
): Promise<{ ontologyId: string; snapshot: CanonicalOntologySnapshot } | null> {
  if (target.type === "ontology") {
    await assertOntologyDocumentAccess(target.id, db)
    const snapshot = await loadCanonicalOntology(target.id, db)
    return { ontologyId: target.id, snapshot }
  }

  const explicitOntologyId =
    (target as { ontologyId?: string; ontology_id?: string }).ontologyId ||
    (target as { ontologyId?: string; ontology_id?: string }).ontology_id
  if (explicitOntologyId) {
    await assertOntologyDocumentAccess(explicitOntologyId, db)
    const snapshot = await loadCanonicalOntology(explicitOntologyId, db)
    return { ontologyId: explicitOntologyId, snapshot }
  }

  const docs = (await db.select().from(ontologyDocuments)) as Array<
    typeof ontologyDocuments.$inferSelect
  >

  for (const doc of docs) {
    if (doc.linkml_yaml && doc.linkml_yaml.includes(target.id)) {
      try {
        const snapshot = await loadCanonicalOntology(doc.id, db)
        await assertOntologyDocumentAccess(doc.id, db)
        return { ontologyId: doc.id, snapshot }
      } catch {
        // continue
      }
    }
  }

  return null
}

export async function getOntologyNotesByOntology(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyNote[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.notes ?? [])
    .map((n, idx) => projectNote(n, ontologyId, idx))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function getOntologyLocalizedTextsByOntology(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyLocalizedText[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.localized_texts ?? [])
    .map((lt, idx) => projectLocalizedText(lt, ontologyId, idx))
    .sort((a, b) => a.field_name.localeCompare(b.field_name))
}

export async function getOntologyExamplesByOntology(
  ontologyId: string,
  db?: AnyDbClient
): Promise<OntologyExample[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return (snapshot.examples ?? [])
    .map((ex, idx) => projectExample(ex, ontologyId, idx))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function getOntologyNotes(
  target: OntologyMetadataTarget,
  db?: AnyDbClient
): Promise<OntologyNote[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  const resolved = await resolveOntologySnapshotForTarget(target, database)
  if (!resolved) return []

  return (resolved.snapshot.notes ?? [])
    .filter((n) => n.target_type === target.type && n.target_id === target.id)
    .map((n, idx) => projectNote(n, resolved.ontologyId, idx))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function getOntologyLocalizedTexts(
  target: OntologyMetadataTarget,
  db?: AnyDbClient
): Promise<OntologyLocalizedText[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  const resolved = await resolveOntologySnapshotForTarget(target, database)
  if (!resolved) return []

  return (resolved.snapshot.localized_texts ?? [])
    .filter(
      (lt) => lt.target_type === target.type && lt.target_id === target.id
    )
    .map((lt, idx) => projectLocalizedText(lt, resolved.ontologyId, idx))
    .sort((a, b) => a.field_name.localeCompare(b.field_name))
}

export async function getOntologyExamples(
  target: OntologyExampleTarget,
  db?: AnyDbClient
): Promise<OntologyExample[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  const resolved = await resolveOntologySnapshotForTarget(target, database)
  if (!resolved) return []

  return (resolved.snapshot.examples ?? [])
    .filter(
      (ex) => ex.target_type === target.type && ex.target_id === target.id
    )
    .map((ex, idx) => projectExample(ex, resolved.ontologyId, idx))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export async function getInstanceCandidateExamples(
  target: OntologyExampleCandidateTarget,
  db?: AnyDbClient
): Promise<OntologyExample[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  const resolved = await resolveOntologySnapshotForTarget(target, database)
  if (!resolved) return []

  return (resolved.snapshot.examples ?? [])
    .filter(
      (ex) =>
        ex.target_type === target.type &&
        ex.target_id === target.id &&
        Boolean(ex.is_instance_candidate)
    )
    .map((ex, idx) => projectExample(ex, resolved.ontologyId, idx))
    .sort((a, b) => a.sort_order - b.sort_order)
}

function resolveImpactRoles(
  cq: Pick<
    OntologyCompetencyQuestion,
    "subject_example_id" | "predicate_example_id" | "object_example_id"
  >,
  exampleId: string
): OntologyExampleImpactRole[] {
  return [
    cq.subject_example_id === exampleId ? "subject" : null,
    cq.predicate_example_id === exampleId ? "predicate" : null,
    cq.object_example_id === exampleId ? "object" : null,
  ].filter((role): role is OntologyExampleImpactRole => role !== null)
}

export async function getAffectedCompetencyQuestionsForExample(
  exampleId: string,
  db?: AnyDbClient
): Promise<OntologyExampleImpact[]> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyRecordAccess("ontology_examples", exampleId, database)
  const rows = await database
    .select({
      id: ontologyCompetencyQuestions.id,
      question: ontologyCompetencyQuestions.question,
      subject_example_id: ontologyCompetencyQuestions.subject_example_id,
      predicate_example_id: ontologyCompetencyQuestions.predicate_example_id,
      object_example_id: ontologyCompetencyQuestions.object_example_id,
    })
    .from(ontologyCompetencyQuestions)
    .where(
      or(
        eq(ontologyCompetencyQuestions.subject_example_id, exampleId),
        eq(ontologyCompetencyQuestions.predicate_example_id, exampleId),
        eq(ontologyCompetencyQuestions.object_example_id, exampleId)
      )
    )
    .orderBy(asc(ontologyCompetencyQuestions.sort_order))

  return rows.map(
    (cq: {
      id: string
      question: string
      subject_example_id: string | null
      predicate_example_id: string | null
      object_example_id: string | null
    }) => ({
      id: cq.id,
      question: cq.question,
      roles: resolveImpactRoles(cq, exampleId),
    })
  )
}
