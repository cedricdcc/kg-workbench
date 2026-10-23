import type { OntologyRelation } from "@/domain/ontology"
import type {
  OntologyClassWithAttributes,
  OntologyCQWithModules,
} from "@/features/ontology/server/queries"

export type CqCoverageStatus = "full" | "partial" | "unmapped"

export interface EvaluatedCqCoverage {
  status: CqCoverageStatus
  hasSubject: boolean
  hasPredicate: boolean
  hasObject: boolean
  subjectClassName?: string
  predicateRelationName?: string
  objectClassName?: string
  totalTriples: number
  mappedTriples: number
}

export interface CqCoverageSummary {
  totalCount: number
  fullCount: number
  partialCount: number
  unmappedCount: number
  coveragePercentage: number
}

/**
 * Evaluate whether an individual Competency Question is mapped to schema concepts.
 */
export function evaluateCqCoverage(
  cq: OntologyCQWithModules,
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): EvaluatedCqCoverage {
  const triples = cq.triples ?? []

  if (triples.length > 0) {
    let fullyMappedTriples = 0
    let partiallyMappedTriples = 0

    for (const t of triples) {
      const hasSub = Boolean(
        t.subject_class_id && classes.some((c) => c.id === t.subject_class_id)
      )
      const hasPred = Boolean(
        t.predicate_relation_id &&
        relations.some((r) => r.id === t.predicate_relation_id)
      )
      const hasObj = Boolean(
        t.object_class_id && classes.some((c) => c.id === t.object_class_id)
      )

      if (hasSub && hasPred && hasObj) {
        fullyMappedTriples++
      } else if (hasSub || hasPred || hasObj) {
        partiallyMappedTriples++
      }
    }

    let status: CqCoverageStatus = "unmapped"
    if (fullyMappedTriples === triples.length) {
      status = "full"
    } else if (fullyMappedTriples > 0 || partiallyMappedTriples > 0) {
      status = "partial"
    }

    const firstTriple = triples[0]
    const firstSub = firstTriple?.subject_class_id
      ? classes.find((c) => c.id === firstTriple.subject_class_id)
      : undefined
    const firstPred = firstTriple?.predicate_relation_id
      ? relations.find((r) => r.id === firstTriple.predicate_relation_id)
      : undefined
    const firstObj = firstTriple?.object_class_id
      ? classes.find((c) => c.id === firstTriple.object_class_id)
      : undefined

    return {
      status,
      hasSubject: Boolean(firstSub),
      hasPredicate: Boolean(firstPred),
      hasObject: Boolean(firstObj),
      subjectClassName: firstSub?.name,
      predicateRelationName: firstPred?.name,
      objectClassName: firstObj?.name,
      totalTriples: triples.length,
      mappedTriples: fullyMappedTriples,
    }
  }

  // Fallback to legacy single-triple columns
  const subjectClass = cq.subject_class_id
    ? classes.find((c) => c.id === cq.subject_class_id)
    : undefined

  const predicateRelation = cq.predicate_relation_id
    ? relations.find((r) => r.id === cq.predicate_relation_id)
    : undefined

  const objectClass = cq.object_class_id
    ? classes.find((c) => c.id === cq.object_class_id)
    : undefined

  const hasSubject = Boolean(subjectClass)
  const hasPredicate = Boolean(predicateRelation)
  const hasObject = Boolean(objectClass)

  let status: CqCoverageStatus = "unmapped"
  if (hasSubject && hasPredicate && hasObject) {
    status = "full"
  } else if (hasSubject || hasPredicate || hasObject) {
    status = "partial"
  }

  const legacyHasAny = Boolean(
    cq.subject_class_id || cq.predicate_relation_id || cq.object_class_id
  )
  const totalTriples = legacyHasAny ? 1 : 0
  const mappedTriples = status === "full" ? 1 : 0

  return {
    status,
    hasSubject,
    hasPredicate,
    hasObject,
    subjectClassName: subjectClass?.name,
    predicateRelationName: predicateRelation?.name,
    objectClassName: objectClass?.name,
    totalTriples,
    mappedTriples,
  }
}

/**
 * Aggregate coverage metrics across an entire array of Competency Questions.
 */
export function calculateCqCoverageSummary(
  cqs: OntologyCQWithModules[],
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): CqCoverageSummary {
  const totalCount = cqs.length
  if (totalCount === 0) {
    return {
      totalCount: 0,
      fullCount: 0,
      partialCount: 0,
      unmappedCount: 0,
      coveragePercentage: 100,
    }
  }

  let fullCount = 0
  let partialCount = 0
  let unmappedCount = 0

  for (const cq of cqs) {
    const evaluated = evaluateCqCoverage(cq, classes, relations)
    if (evaluated.status === "full") {
      fullCount++
    } else if (evaluated.status === "partial") {
      partialCount++
    } else {
      unmappedCount++
    }
  }

  const coveragePercentage = Math.round((fullCount / totalCount) * 100)

  return {
    totalCount,
    fullCount,
    partialCount,
    unmappedCount,
    coveragePercentage,
  }
}
