import type { OntologyAttribute, OntologyRelation } from "@/domain/ontology"
import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"

export function validateHierarchyAcyclicity(
  classId: string,
  targetParentClassId: string | null,
  allClasses: Array<{
    id: string
    parent_class_id?: string | null
    name?: string
  }>
): { valid: boolean; cyclePath?: string[] } {
  if (!targetParentClassId || targetParentClassId === "__none__") {
    return { valid: true }
  }

  if (classId === targetParentClassId) {
    return { valid: false, cyclePath: [classId, classId] }
  }

  const parentMap = new Map<string, string | null>()
  for (const c of allClasses) {
    parentMap.set(c.id, c.parent_class_id ?? null)
  }

  // Hypothetically set the new parent
  parentMap.set(classId, targetParentClassId)

  // Traverse up from targetParentClassId to see if we ever reach classId
  const visited = new Set<string>()
  const path: string[] = [classId]
  let current: string | null | undefined = targetParentClassId

  while (current) {
    path.push(current)
    if (current === classId) {
      return { valid: false, cyclePath: path }
    }
    if (visited.has(current)) {
      // Loop detected that doesn't involve classId directly, but hierarchy is broken
      break
    }
    visited.add(current)
    current = parentMap.get(current)
  }

  return { valid: true }
}

export function getAncestorClassIds(
  classId: string,
  classMap: Map<string, OntologyClassWithAttributes>
): string[] {
  const ancestors: string[] = []
  const visited = new Set<string>()
  let current = classMap.get(classId)?.parent_class_id

  while (current && !visited.has(current)) {
    visited.add(current)
    ancestors.push(current)
    current = classMap.get(current)?.parent_class_id
  }

  return ancestors
}

export function computeInheritedAttributesAndRelations(
  classId: string,
  allClasses: OntologyClassWithAttributes[],
  allRelations: OntologyRelation[]
): {
  inheritedAttributes: Array<
    OntologyAttribute & {
      inheritedFromClassName: string
      inheritedFromClassId: string
    }
  >
  inheritedRelations: Array<
    OntologyRelation & {
      inheritedFromClassName: string
      inheritedFromClassId: string
      role: "domain" | "range"
    }
  >
} {
  const classMap = new Map(allClasses.map((c) => [c.id, c]))
  const ancestorIds = getAncestorClassIds(classId, classMap)

  const inheritedAttributes: Array<
    OntologyAttribute & {
      inheritedFromClassName: string
      inheritedFromClassId: string
    }
  > = []

  for (const ancId of ancestorIds) {
    const anc = classMap.get(ancId)
    if (!anc) continue
    for (const attr of anc.attributes) {
      inheritedAttributes.push({
        ...attr,
        inheritedFromClassName: anc.name,
        inheritedFromClassId: anc.id,
      })
    }
  }

  const ancestorSet = new Set(ancestorIds)
  const inheritedRelations: Array<
    OntologyRelation & {
      inheritedFromClassName: string
      inheritedFromClassId: string
      role: "domain" | "range"
    }
  > = []

  for (const rel of allRelations) {
    if (ancestorSet.has(rel.domain_class_id)) {
      const anc = classMap.get(rel.domain_class_id)
      inheritedRelations.push({
        ...rel,
        inheritedFromClassName: anc?.name ?? "Superclass",
        inheritedFromClassId: rel.domain_class_id,
        role: "domain",
      })
    } else if (ancestorSet.has(rel.range_class_id)) {
      const anc = classMap.get(rel.range_class_id)
      inheritedRelations.push({
        ...rel,
        inheritedFromClassName: anc?.name ?? "Superclass",
        inheritedFromClassId: rel.range_class_id,
        role: "range",
      })
    }
  }

  return { inheritedAttributes, inheritedRelations }
}
