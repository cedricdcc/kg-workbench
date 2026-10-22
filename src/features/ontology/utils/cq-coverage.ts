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

  return {
    status,
    hasSubject,
    hasPredicate,
    hasObject,
    subjectClassName: subjectClass?.name,
    predicateRelationName: predicateRelation?.name,
    objectClassName: objectClass?.name,
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
