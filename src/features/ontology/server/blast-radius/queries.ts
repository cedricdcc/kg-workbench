import { eq, inArray, or } from "drizzle-orm"
import { getDb } from "@/server/database"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import {
  documentEntities,
  facts,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
} from "@/server/db/schema"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import {
  buildClassBlastRadiusReport,
  buildRelationBlastRadiusReport,
} from "./calculate"
import type { BlastRadiusReport } from "./types"

export async function getClassBlastRadius(
  ontologyId: string,
  classId: string,
  db?: AnyDbClient
): Promise<BlastRadiusReport> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)

  const snapshot = await loadCanonicalOntology(ontologyId, database)

  // 1. Fetch target class
  const targetClass = snapshot.classes?.find((c) => c.id === classId)
  if (!targetClass) {
    throw new Error(`Class ${classId} not found.`)
  }

  // 2. Fetch all classes in ontology for lookup
  const classNameMap = new Map(
    (snapshot.classes ?? []).map((c) => [c.id, c.name])
  )

  // 3. Subclasses (child classes pointing to this class as parent)
  const subclasses = (snapshot.classes ?? [])
    .filter((c) => c.parent_class_id === classId)
    .map((c) => ({ id: c.id, name: c.name }))

  // 4. Inbound and outbound relations
  const rawRelations = (snapshot.relations ?? []).filter(
    (r) => r.domain_class_id === classId || r.range_class_id === classId
  )

  const relations = rawRelations.map((r) => {
    const otherId =
      r.domain_class_id === classId ? r.range_class_id : r.domain_class_id
    const otherClassName = classNameMap.get(otherId) ?? "Unknown Class"
    return {
      id: r.id,
      name: r.name,
      source_class_id: r.domain_class_id,
      target_class_id: r.range_class_id,
      otherClassName,
    }
  })

  // 5. Attributes
  const attributes = (snapshot.attributes ?? [])
    .filter((a) => a.class_id === classId)
    .map((a) => ({
      id: a.id,
      name: a.name,
      data_type: a.data_type ?? "string",
    }))

  // 6. Competency Questions (CQ Triples + Legacy fields)
  let allCqs: Array<{
    id: string
    question: string
    subject_class_id: string | null
    object_class_id: string | null
  }> = []
  let cqTriples: Array<{
    cq_id: string
    subject_class_id: string | null
    object_class_id: string | null
  }> = []

  try {
    const [cqsRes, triplesRes] = await Promise.all([
      database
        .select({
          id: ontologyCompetencyQuestions.id,
          question: ontologyCompetencyQuestions.question,
          subject_class_id: ontologyCompetencyQuestions.subject_class_id,
          object_class_id: ontologyCompetencyQuestions.object_class_id,
        })
        .from(ontologyCompetencyQuestions)
        .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId)),
      database
        .select({
          cq_id: ontologyCqTriples.cq_id,
          subject_class_id: ontologyCqTriples.subject_class_id,
          object_class_id: ontologyCqTriples.object_class_id,
        })
        .from(ontologyCqTriples),
    ])
    allCqs = cqsRes ?? []
    cqTriples = triplesRes ?? []
  } catch {
    // Competency questions tables may be empty in test environments
  }

  const cqRolesMap = new Map<string, Set<"subject" | "predicate" | "object">>()

  for (const t of cqTriples) {
    if (t.subject_class_id === classId) {
      const set = cqRolesMap.get(t.cq_id) ?? new Set()
      set.add("subject")
      cqRolesMap.set(t.cq_id, set)
    }
    if (t.object_class_id === classId) {
      const set = cqRolesMap.get(t.cq_id) ?? new Set()
      set.add("object")
      cqRolesMap.set(t.cq_id, set)
    }
  }

  for (const cq of allCqs) {
    if (cq.subject_class_id === classId) {
      const set = cqRolesMap.get(cq.id) ?? new Set()
      set.add("subject")
      cqRolesMap.set(cq.id, set)
    }
    if (cq.object_class_id === classId) {
      const set = cqRolesMap.get(cq.id) ?? new Set()
      set.add("object")
      cqRolesMap.set(cq.id, set)
    }
  }

  const impactedCqs = allCqs
    .filter((cq) => cqRolesMap.has(cq.id))
    .map((cq) => ({
      id: cq.id,
      question: cq.question,
      roles: Array.from(cqRolesMap.get(cq.id)!),
    }))

  // 7. Extracted Document Entities and Facts
  let entities: Array<{ id: string }> = []
  let factsCount = 0

  try {
    entities =
      (await database
        .select({ id: documentEntities.id })
        .from(documentEntities)
        .where(eq(documentEntities.class_id, classId))) ?? []

    if (entities.length > 0) {
      const entityIds = entities.map((e) => e.id)
      const matchedFacts =
        (await database
          .select({ id: facts.id })
          .from(facts)
          .where(
            or(
              inArray(facts.subject_entity_id, entityIds),
              inArray(facts.object_entity_id, entityIds)
            )
          )) ?? []
      factsCount = matchedFacts.length
    }
  } catch (err) {
    console.error("DEBUG ERR IN BLAST RADIUS:", err)
    // Entities and facts tables may be empty
  }

  return buildClassBlastRadiusReport({
    targetClass,
    subclasses,
    relations,
    attributes,
    cqs: impactedCqs,
    entitiesCount: entities.length,
    factsCount,
  })
}

export async function getRelationBlastRadius(
  ontologyId: string,
  relationId: string,
  db?: AnyDbClient
): Promise<BlastRadiusReport> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)

  const snapshot = await loadCanonicalOntology(ontologyId, database)

  const targetRelation = snapshot.relations?.find((r) => r.id === relationId)
  if (!targetRelation) {
    throw new Error(`Relation ${relationId} not found.`)
  }

  // Attributes on relation
  const attributes = (snapshot.relation_attributes ?? [])
    .filter((ra) => ra.relation_id === relationId)
    .map((ra) => ({
      id: ra.id,
      name: ra.name,
      data_type: ra.data_type ?? "string",
    }))

  // Competency Questions
  let allCqs: Array<{
    id: string
    question: string
    predicate_relation_id: string | null
  }> = []
  let cqTriples: Array<{
    cq_id: string
    predicate_relation_id: string | null
  }> = []

  try {
    const [cqsRes, triplesRes] = await Promise.all([
      database
        .select({
          id: ontologyCompetencyQuestions.id,
          question: ontologyCompetencyQuestions.question,
          predicate_relation_id:
            ontologyCompetencyQuestions.predicate_relation_id,
        })
        .from(ontologyCompetencyQuestions)
        .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId)),
      database
        .select({
          cq_id: ontologyCqTriples.cq_id,
          predicate_relation_id: ontologyCqTriples.predicate_relation_id,
        })
        .from(ontologyCqTriples)
        .where(eq(ontologyCqTriples.predicate_relation_id, relationId)),
    ])
    allCqs = cqsRes ?? []
    cqTriples = triplesRes ?? []
  } catch {
    // CQ tables may be empty in test environments
  }

  const cqIds = new Set(cqTriples.map((t) => t.cq_id))
  for (const cq of allCqs) {
    if (cq.predicate_relation_id === relationId) {
      cqIds.add(cq.id)
    }
  }

  const impactedCqs = allCqs
    .filter((cq) => cqIds.has(cq.id))
    .map((cq) => ({
      id: cq.id,
      question: cq.question,
      roles: ["predicate" as const],
    }))

  // Facts using this relation
  let factsCount = 0
  try {
    const matchedFacts =
      (await database
        .select({ id: facts.id })
        .from(facts)
        .where(eq(facts.relation_type_id, relationId))) ?? []
    factsCount = matchedFacts.length
  } catch {
    // Facts may be empty
  }

  return buildRelationBlastRadiusReport({
    targetRelation,
    cqs: impactedCqs,
    attributes,
    factsCount,
  })
}

export async function getBlastRadiusData(
  ontologyId: string,
  targetIdOrType: string,
  maybeTargetId?: string,
  db?: AnyDbClient
): Promise<BlastRadiusReport> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>

  if (maybeTargetId !== undefined) {
    if (targetIdOrType === "class") {
      return getClassBlastRadius(ontologyId, maybeTargetId, database)
    }
    return getRelationBlastRadius(ontologyId, maybeTargetId, database)
  }

  const targetId = targetIdOrType
  const snapshot = await loadCanonicalOntology(ontologyId, database)
  const isClass = snapshot.classes?.some((c) => c.id === targetId)

  if (isClass) {
    return getClassBlastRadius(ontologyId, targetId, database)
  }
  return getRelationBlastRadius(ontologyId, targetId, database)
}
