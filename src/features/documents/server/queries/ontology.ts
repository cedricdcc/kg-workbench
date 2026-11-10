"use server"

import { asc, desc, eq, inArray } from "drizzle-orm"
import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"
import {
  assertDocumentAccess,
  assertOntologyDocumentAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  extractionRuns,
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyExamples,
  ontologyModules,
} from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "@/features/ontology/server/linkml/document-store"
import type { DocumentOntology } from "./types"

export async function getOntologyForDocument(
  documentId: string,
  db?: AnyDbClient
): Promise<DocumentOntology> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertDocumentAccess(documentId, database)

  const [run] = await database
    .select({ ontology_id: extractionRuns.ontology_id })
    .from(extractionRuns)
    .where(eq(extractionRuns.document_id, documentId))
    .orderBy(desc(extractionRuns.completed_at))
    .limit(1)

  if (!run?.ontology_id) {
    return {
      classes: [],
      relations: [],
      modules: [],
      attributes: [],
      relationAttributes: [],
      cqs: [],
      examples: [],
    }
  }

  await assertOntologyDocumentAccess(run.ontology_id, database)
  const snapshot = await loadCanonicalOntology(run.ontology_id, database)

  const classes = (snapshot.classes ?? [])
    .map((cls) => ({
      id: cls.id,
      name: cls.name,
      module_id: cls.module_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const relations = (snapshot.relations ?? [])
    .map((rel) => ({
      id: rel.id,
      name: rel.name,
      domain_class_id: rel.domain_class_id,
      range_class_id: rel.range_class_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const modules = (snapshot.modules ?? [])
    .map((mod) => ({
      id: mod.id,
      name: mod.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const attributes = (snapshot.attributes ?? [])
    .map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      dataType: normalizeOntologyDataTypeOrDefault(attribute.data_type),
      classId: attribute.class_id,
      required: attribute.required ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const relationAttributes = (snapshot.relation_attributes ?? [])
    .map((attribute) => ({
      id: attribute.id,
      relationId: attribute.relation_id,
      name: attribute.name,
      dataType: normalizeOntologyDataTypeOrDefault(attribute.data_type),
      description: attribute.description ?? "",
      required: attribute.required ?? false,
      sortOrder: attribute.sort_order ?? 0,
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  let cqs: Array<typeof ontologyCompetencyQuestions.$inferSelect> = []
  try {
    cqs =
      (await database
        .select()
        .from(ontologyCompetencyQuestions)
        .where(eq(ontologyCompetencyQuestions.ontology_id, run.ontology_id))
        .orderBy(asc(ontologyCompetencyQuestions.sort_order))) ?? []
  } catch {
    // CQ table might be empty
  }

  const exampleIds = [
    ...new Set(
      cqs.flatMap((cq) =>
        [
          cq.subject_example_id,
          cq.predicate_example_id,
          cq.object_example_id,
        ].filter((id): id is string => Boolean(id))
      )
    ),
  ]

  let examples: Array<{ id: string; value: string }> = []
  let links: Array<{
    cq_id: string
    module: { id: string; name: string }
  }> = []

  // Examples from snapshot
  const snapshotExamples = (snapshot.examples ?? [])
    .filter((ex) => ex.id && exampleIds.includes(ex.id))
    .map((ex) => ({ id: ex.id!, value: ex.value }))

  if (exampleIds.length > 0) {
    try {
      const dbExamples = await database
        .select({ id: ontologyExamples.id, value: ontologyExamples.value })
        .from(ontologyExamples)
        .where(inArray(ontologyExamples.id, exampleIds))
        .orderBy(asc(ontologyExamples.sort_order))
      const combined = [...snapshotExamples, ...(dbExamples ?? [])]
      const seen = new Set<string>()
      examples = combined.filter((ex) => {
        if (seen.has(ex.id)) return false
        seen.add(ex.id)
        return true
      })
    } catch {
      examples = snapshotExamples
    }
  } else {
    examples = snapshotExamples
  }

  if (cqs.length > 0) {
    try {
      links =
        (await database
          .select({
            cq_id: ontologyCompetencyQuestionModules.cq_id,
            module: { id: ontologyModules.id, name: ontologyModules.name },
          })
          .from(ontologyCompetencyQuestionModules)
          .innerJoin(
            ontologyModules,
            eq(ontologyCompetencyQuestionModules.module_id, ontologyModules.id)
          )
          .where(
            inArray(
              ontologyCompetencyQuestionModules.cq_id,
              cqs.map((cq) => cq.id)
            )
          )) ?? []
    } catch {
      links = []
    }
  }

  const modulesByCq = new Map<string, { id: string; name: string }[]>()
  for (const link of links) {
    const values = modulesByCq.get(link.cq_id) ?? []
    values.push(link.module)
    modulesByCq.set(link.cq_id, values)
  }

  return {
    classes,
    relations,
    modules,
    attributes,
    relationAttributes,
    cqs: cqs.map((cq) => ({
      id: cq.id,
      question: cq.question,
      sortOrder: cq.sort_order,
      subjectClassId: cq.subject_class_id,
      predicateRelationId: cq.predicate_relation_id,
      objectClassId: cq.object_class_id,
      subjectExampleId: cq.subject_example_id,
      predicateExampleId: cq.predicate_example_id,
      objectExampleId: cq.object_example_id,
      modules: modulesByCq.get(cq.id) ?? [],
    })),
    examples,
  }
}

export async function fetchOntologyForDocument(
  documentId: string,
  db?: AnyDbClient
) {
  return getOntologyForDocument(documentId, db)
}
