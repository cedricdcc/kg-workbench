export type BlastRadiusSeverity = "low" | "medium" | "high" | "critical"

export type ImpactedCompetencyQuestion = {
  id: string
  question: string
  roles: Array<"subject" | "predicate" | "object">
}

export type ImpactedRelation = {
  id: string
  name: string
  direction: "outgoing" | "incoming" | "both"
  otherClassName: string
}

export type ImpactedSubclass = {
  id: string
  name: string
}

export type ImpactedAttribute = {
  id: string
  name: string
  dataType: string
}

export type BlastRadiusMetrics = {
  cqsCount: number
  factsCount: number
  entitiesCount: number
  relationsCount: number
  subclassesCount: number
  attributesCount: number
}

export type BlastRadiusReport = {
  targetId: string
  targetType: "class" | "relation"
  targetName: string
  riskScore: number // 0 to 100
  severity: BlastRadiusSeverity
  summary: {
    affectedCqsCount: number
    affectedFactsCount: number
    affectedEntitiesCount: number
    affectedRelationsCount: number
    affectedSubclassesCount: number
    affectedAttributesCount: number
  }
  details: {
    competencyQuestions: ImpactedCompetencyQuestion[]
    relations: ImpactedRelation[]
    subclasses: ImpactedSubclass[]
    attributes: ImpactedAttribute[]
  }
}
