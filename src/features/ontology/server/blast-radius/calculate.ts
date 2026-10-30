import type {
  BlastRadiusMetrics,
  BlastRadiusReport,
  BlastRadiusSeverity,
  ImpactedAttribute,
  ImpactedCompetencyQuestion,
  ImpactedRelation,
  ImpactedSubclass,
} from "./types"

export function calculateRiskScore(metrics: BlastRadiusMetrics): {
  score: number
  severity: BlastRadiusSeverity
} {
  const cqsWeight = Math.min(50, metrics.cqsCount * 20)
  const factsWeight = Math.min(30, metrics.factsCount * 2)
  const subclassesWeight = Math.min(20, metrics.subclassesCount * 10)
  const relationsWeight = Math.min(15, metrics.relationsCount * 5)
  const entitiesWeight = Math.min(10, metrics.entitiesCount * 1)
  const attributesWeight = Math.min(5, metrics.attributesCount * 1)

  const total = Math.min(
    100,
    cqsWeight +
      factsWeight +
      subclassesWeight +
      relationsWeight +
      entitiesWeight +
      attributesWeight
  )

  let severity: BlastRadiusSeverity = "low"
  if (total >= 71) {
    severity = "critical"
  } else if (total >= 41) {
    severity = "high"
  } else if (total >= 16) {
    severity = "medium"
  }

  return { score: total, severity }
}

export function buildClassBlastRadiusReport(params: {
  targetClass: { id: string; name: string }
  subclasses: Array<{ id: string; name: string }>
  relations: Array<{
    id: string
    name: string
    source_class_id: string
    target_class_id: string
    otherClassName: string
  }>
  attributes: Array<{ id: string; name: string; data_type: string }>
  cqs: Array<{
    id: string
    question: string
    roles: Array<"subject" | "predicate" | "object">
  }>
  entitiesCount: number
  factsCount: number
}): BlastRadiusReport {
  const {
    targetClass,
    subclasses,
    relations,
    attributes,
    cqs,
    entitiesCount,
    factsCount,
  } = params

  const impactedRelations: ImpactedRelation[] = relations.map((r) => {
    let direction: "outgoing" | "incoming" | "both" = "outgoing"
    if (
      r.source_class_id === targetClass.id &&
      r.target_class_id === targetClass.id
    ) {
      direction = "both"
    } else if (r.target_class_id === targetClass.id) {
      direction = "incoming"
    }
    return {
      id: r.id,
      name: r.name,
      direction,
      otherClassName: r.otherClassName,
    }
  })

  const impactedSubclasses: ImpactedSubclass[] = subclasses.map((s) => ({
    id: s.id,
    name: s.name,
  }))

  const impactedAttributes: ImpactedAttribute[] = attributes.map((a) => ({
    id: a.id,
    name: a.name,
    dataType: a.data_type,
  }))

  const impactedCqs: ImpactedCompetencyQuestion[] = cqs.map((cq) => ({
    id: cq.id,
    question: cq.question,
    roles: cq.roles,
  }))

  const { score, severity } = calculateRiskScore({
    cqsCount: impactedCqs.length,
    factsCount,
    entitiesCount,
    relationsCount: impactedRelations.length,
    subclassesCount: impactedSubclasses.length,
    attributesCount: impactedAttributes.length,
  })

  return {
    targetId: targetClass.id,
    targetType: "class",
    targetName: targetClass.name,
    riskScore: score,
    severity,
    summary: {
      affectedCqsCount: impactedCqs.length,
      affectedFactsCount: factsCount,
      affectedEntitiesCount: entitiesCount,
      affectedRelationsCount: impactedRelations.length,
      affectedSubclassesCount: impactedSubclasses.length,
      affectedAttributesCount: impactedAttributes.length,
    },
    details: {
      competencyQuestions: impactedCqs,
      relations: impactedRelations,
      subclasses: impactedSubclasses,
      attributes: impactedAttributes,
    },
  }
}

export function buildRelationBlastRadiusReport(params: {
  targetRelation: { id: string; name: string }
  cqs: Array<{
    id: string
    question: string
    roles: Array<"subject" | "predicate" | "object">
  }>
  attributes: Array<{ id: string; name: string; data_type: string }>
  factsCount: number
}): BlastRadiusReport {
  const { targetRelation, cqs, attributes, factsCount } = params

  const impactedAttributes: ImpactedAttribute[] = attributes.map((a) => ({
    id: a.id,
    name: a.name,
    dataType: a.data_type,
  }))

  const impactedCqs: ImpactedCompetencyQuestion[] = cqs.map((cq) => ({
    id: cq.id,
    question: cq.question,
    roles: cq.roles,
  }))

  const { score, severity } = calculateRiskScore({
    cqsCount: impactedCqs.length,
    factsCount,
    entitiesCount: 0,
    relationsCount: 1,
    subclassesCount: 0,
    attributesCount: impactedAttributes.length,
  })

  return {
    targetId: targetRelation.id,
    targetType: "relation",
    targetName: targetRelation.name,
    riskScore: score,
    severity,
    summary: {
      affectedCqsCount: impactedCqs.length,
      affectedFactsCount: factsCount,
      affectedEntitiesCount: 0,
      affectedRelationsCount: 1,
      affectedSubclassesCount: 0,
      affectedAttributesCount: impactedAttributes.length,
    },
    details: {
      competencyQuestions: impactedCqs,
      relations: [],
      subclasses: [],
      attributes: impactedAttributes,
    },
  }
}
