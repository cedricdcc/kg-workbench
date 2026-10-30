import { and, eq, or } from "drizzle-orm"
import { getDb } from "@/server/database"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import {
  documentEntities,
  facts,
  ontologyAttributes,
  ontologyClasses,
  ontologyCompetencyQuestions,
  ontologyCqTriples,
  ontologyRelationAttributes,
  ontologyRelations,
} from "@/server/db/schema"
import {
  buildClassBlastRadiusReport,
  buildRelationBlastRadiusReport,
} from "./calculate"
import type { BlastRadiusReport } from "./types"

export async function getClassBlastRadius(
  ontologyId: string,
  classId: string
): Promise<BlastRadiusReport> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  await assertOntologyRecordAccess("ontology_classes", classId, db)

  // 1. Fetch target class
  const [targetClass] = await db
    .select({ id: ontologyClasses.id, name: ontologyClasses.name })
    .from(ontologyClasses)
    .where(eq(ontologyClasses.id, classId))
    .limit(1)

  if (!targetClass) {
    throw new Error(`Class ${classId} not found.`)
  }

  // 2. Fetch all classes in ontology for lookup
  const allClasses = await db
    .select({ id: ontologyClasses.id, name: ontologyClasses.name })
    .from(ontologyClasses)
    .where(eq(ontologyClasses.ontology_id, ontologyId))

  const classNameMap = new Map(allClasses.map((c) => [c.id, c.name]))

  // 3. Subclasses (child classes pointing to this class as parent)
  const subclasses = await db
    .select({ id: ontologyClasses.id, name: ontologyClasses.name })
    .from(ontologyClasses)
    .where(
      and(
        eq(ontologyClasses.ontology_id, ontologyId),
        eq(ontologyClasses.parent_class_id, classId)
      )
    )

  // 4. Inbound and outbound relations
  const rawRelations = await db
    .select({
      id: ontologyRelations.id,
      name: ontologyRelations.name,
      domain_class_id: ontologyRelations.domain_class_id,
      range_class_id: ontologyRelations.range_class_id,
    })
    .from(ontologyRelations)
    .where(
      and(
        eq(ontologyRelations.ontology_id, ontologyId),
        or(
          eq(ontologyRelations.domain_class_id, classId),
          eq(ontologyRelations.range_class_id, classId)
        )
      )
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
  const attributes = await db
    .select({
      id: ontologyAttributes.id,
      name: ontologyAttributes.name,
      data_type: ontologyAttributes.data_type,
    })
    .from(ontologyAttributes)
    .where(eq(ontologyAttributes.class_id, classId))

  // 6. Competency Questions (CQ Triples + Legacy fields)
  const allCqs = await db
    .select({
      id: ontologyCompetencyQuestions.id,
      question: ontologyCompetencyQuestions.question,
      subject_class_id: ontologyCompetencyQuestions.subject_class_id,
      object_class_id: ontologyCompetencyQuestions.object_class_id,
    })
    .from(ontologyCompetencyQuestions)
    .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))

  const cqTriples = await db
    .select({
      cq_id: ontologyCqTriples.cq_id,
      subject_class_id: ontologyCqTriples.subject_class_id,
      object_class_id: ontologyCqTriples.object_class_id,
    })
    .from(ontologyCqTriples)

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
  const entities = await db
    .select({ id: documentEntities.id })
    .from(documentEntities)
    .where(eq(documentEntities.class_id, classId))

  let factsCount = 0
  if (entities.length > 0) {
    const entityIds = entities.map((e) => e.id)
    const matchedFacts = await db
      .select({ id: facts.id })
      .from(facts)
      .where(
        or(
          eq(facts.subject_entity_id, entityIds[0]),
          eq(facts.object_entity_id, entityIds[0])
        )
      )
    factsCount = matchedFacts.length
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
  relationId: string
): Promise<BlastRadiusReport> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  await assertOntologyRecordAccess("ontology_relations", relationId, db)

  const [targetRelation] = await db
    .select({ id: ontologyRelations.id, name: ontologyRelations.name })
    .from(ontologyRelations)
    .where(eq(ontologyRelations.id, relationId))
    .limit(1)

  if (!targetRelation) {
    throw new Error(`Relation ${relationId} not found.`)
  }

  // Attributes on relation
  const attributes = await db
    .select({
      id: ontologyRelationAttributes.id,
      name: ontologyRelationAttributes.name,
      data_type: ontologyRelationAttributes.data_type,
    })
    .from(ontologyRelationAttributes)
    .where(eq(ontologyRelationAttributes.relation_id, relationId))

  // Competency Questions
  const allCqs = await db
    .select({
      id: ontologyCompetencyQuestions.id,
      question: ontologyCompetencyQuestions.question,
      predicate_relation_id: ontologyCompetencyQuestions.predicate_relation_id,
    })
    .from(ontologyCompetencyQuestions)
    .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))

  const cqTriples = await db
    .select({
      cq_id: ontologyCqTriples.cq_id,
      predicate_relation_id: ontologyCqTriples.predicate_relation_id,
    })
    .from(ontologyCqTriples)
    .where(eq(ontologyCqTriples.predicate_relation_id, relationId))

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
  const matchedFacts = await db
    .select({ id: facts.id })
    .from(facts)
    .where(eq(facts.relation_type_id, relationId))

  return buildRelationBlastRadiusReport({
    targetRelation,
    cqs: impactedCqs,
    attributes,
    factsCount: matchedFacts.length,
  })
}
