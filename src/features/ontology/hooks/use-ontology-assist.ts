import { useMemo } from "react"
import { validateHierarchyAcyclicity } from "@/features/ontology/utils/hierarchy-validation"

export interface OntologyAssistResult {
  hasCollision: boolean
  collisionMessage?: string
  standardSuggestion?: {
    curie: string
    label: string
    type: "class" | "property"
    similarity: number
    description?: string
  }
  isCycle?: boolean
  cycleMessage?: string
}

export interface EvaluateOntologyAssistParams {
  query: string
  entityType: "class" | "attribute" | "relation"
  targetClassId?: string
  parentClassId?: string | null
  allClasses: Array<{
    id: string
    name: string
    parent_class_id?: string | null
    module_id?: string | null
  }>
  referenceTerms?: Array<{
    curie: string
    label: string
    type: string
    description?: string
    domainIris?: string[]
  }>
}

export function evaluateOntologyAssistance(
  params: EvaluateOntologyAssistParams
): OntologyAssistResult {
  const result: OntologyAssistResult = {
    hasCollision: false,
  }

  const trimmedQuery = params.query.trim()
  const lowerQuery = trimmedQuery.toLowerCase()

  // 1. Name collision check
  if (params.entityType === "class" && trimmedQuery.length > 0) {
    const existing = params.allClasses.find(
      (c) =>
        c.name.trim().toLowerCase() === lowerQuery &&
        c.id !== params.targetClassId
    )
    if (existing) {
      result.hasCollision = true
      result.collisionMessage = `Class "${existing.name}" already exists in this ontology.`
    }
  }

  // 2. Hierarchy acyclicity check
  if (
    params.entityType === "class" &&
    params.targetClassId &&
    params.parentClassId &&
    params.parentClassId !== "__none__"
  ) {
    const cycleCheck = validateHierarchyAcyclicity(
      params.targetClassId,
      params.parentClassId,
      params.allClasses
    )
    if (!cycleCheck.valid) {
      result.isCycle = true
      result.cycleMessage = `Selecting this parent would create a hierarchy cycle: ${
        cycleCheck.cyclePath?.join(" → ") ?? ""
      }`
    }
  }

  // 3. Standard vocabulary suggestion match
  if (trimmedQuery.length > 0 && params.referenceTerms?.length) {
    const targetType = params.entityType === "class" ? "class" : "property"

    // Exact label or curie suffix match first
    const match =
      params.referenceTerms.find(
        (t) =>
          t.type === targetType &&
          (t.label.toLowerCase() === lowerQuery ||
            t.curie.toLowerCase() === lowerQuery ||
            t.curie.toLowerCase().endsWith(`:${lowerQuery}`))
      ) ??
      params.referenceTerms.find(
        (t) =>
          t.type === targetType && t.label.toLowerCase().includes(lowerQuery)
      )

    if (match) {
      result.standardSuggestion = {
        curie: match.curie,
        label: match.label,
        type: match.type as "class" | "property",
        similarity: 1.0,
        description: match.description,
      }
    }
  }

  return result
}

export function useOntologyAssist(
  params: EvaluateOntologyAssistParams
): OntologyAssistResult {
  return useMemo(
    () => evaluateOntologyAssistance(params),
    [
      params.query,
      params.entityType,
      params.targetClassId,
      params.parentClassId,
      params.allClasses,
      params.referenceTerms,
    ]
  )
}
