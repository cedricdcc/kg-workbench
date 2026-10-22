import type { OntologyClassWithAttributes } from "@/features/ontology/server/queries"
import type { OntologyRelation } from "@/domain/ontology"
import type { OntologyDefect } from "./types"

export function checkSubclassCycles(
  classes: OntologyClassWithAttributes[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []
  const classMap = new Map(classes.map((c) => [c.id, c]))
  const parentMap = new Map<string, string>()

  for (const c of classes) {
    if (c.parent_class_id) {
      parentMap.set(c.id, c.parent_class_id)
    }
  }

  // 1. Direct self-loops (A -> A)
  const selfLoopIds = new Set<string>()
  for (const c of classes) {
    if (c.parent_class_id === c.id) {
      selfLoopIds.add(c.id)
      defects.push({
        id: `subclass_cycle:class:${c.id}`,
        kind: "subclass_cycle",
        severity: "error",
        targetType: "class",
        targetId: c.id,
        targetName: c.name,
        title: "Circular subclass hierarchy detected",
        description: `Class "${c.name}" is set as its own parent class, creating an immediate self-loop.`,
        suggestedAction: "Clear or change the parent class reference.",
        oopsPitfallId: "P29",
        quickFixType: "clear_parent",
      })
    }
  }

  // 2. Transitive cycles
  // 0 = unvisited, 1 = visiting (on current stack), 2 = visited
  const state = new Map<string, number>()
  const cycleClassIds = new Set<string>()

  for (const c of classes) {
    if (selfLoopIds.has(c.id) || state.get(c.id) === 2) continue

    const stack: string[] = []
    let curr: string | undefined = c.id

    while (curr && classMap.has(curr)) {
      const s = state.get(curr) ?? 0
      if (s === 1) {
        // Cycle detected!
        const cycleStartIndex = stack.indexOf(curr)
        if (cycleStartIndex !== -1) {
          const cyclePath = stack.slice(cycleStartIndex)
          for (const cycleNodeId of cyclePath) {
            cycleClassIds.add(cycleNodeId)
          }
        }
        break
      }
      if (s === 2) {
        break
      }

      state.set(curr, 1)
      stack.push(curr)
      curr = parentMap.get(curr)
    }

    for (const nodeOnStack of stack) {
      state.set(nodeOnStack, 2)
    }
  }

  for (const cycleId of cycleClassIds) {
    if (selfLoopIds.has(cycleId)) continue
    const targetClass = classMap.get(cycleId)
    if (!targetClass) continue

    defects.push({
      id: `subclass_cycle:class:${cycleId}`,
      kind: "subclass_cycle",
      severity: "error",
      targetType: "class",
      targetId: cycleId,
      targetName: targetClass.name,
      title: "Circular subclass hierarchy detected",
      description: `Class "${targetClass.name}" is part of a circular inheritance chain. Circular hierarchies render all participating concepts logically equivalent.`,
      suggestedAction: "Clear or reassign the parent class reference to break the cycle.",
      oopsPitfallId: "P29",
      quickFixType: "clear_parent",
    })
  }

  return defects
}

export function checkDanglingRelations(
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []
  const classIdSet = new Set(classes.map((c) => c.id))

  for (const rel of relations) {
    if (!classIdSet.has(rel.domain_class_id)) {
      defects.push({
        id: `dangling_relation_domain:relation:${rel.id}`,
        kind: "dangling_relation_domain",
        severity: "error",
        targetType: "relation",
        targetId: rel.id,
        targetName: rel.name,
        title: "Dangling relation domain",
        description: `Relation "${rel.name}" references non-existent domain class ID "${rel.domain_class_id}".`,
        suggestedAction: "Delete the relation or reassign its domain class.",
        oopsPitfallId: "P10",
        quickFixType: "delete_relation",
      })
    }

    if (!classIdSet.has(rel.range_class_id)) {
      defects.push({
        id: `dangling_relation_range:relation:${rel.id}`,
        kind: "dangling_relation_range",
        severity: "error",
        targetType: "relation",
        targetId: rel.id,
        targetName: rel.name,
        title: "Dangling relation range",
        description: `Relation "${rel.name}" references non-existent range class ID "${rel.range_class_id}".`,
        suggestedAction: "Delete the relation or reassign its range class.",
        oopsPitfallId: "P10",
        quickFixType: "delete_relation",
      })
    }
  }

  return defects
}

export function checkOrphanClasses(
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []
  if (classes.length <= 1) return defects

  const hasChildren = new Set<string>()
  for (const c of classes) {
    if (c.parent_class_id) {
      hasChildren.add(c.parent_class_id)
    }
  }

  const referencedInRelations = new Set<string>()
  for (const rel of relations) {
    referencedInRelations.add(rel.domain_class_id)
    referencedInRelations.add(rel.range_class_id)
  }

  for (const c of classes) {
    const isRoot = !c.parent_class_id
    const isLeaf = !hasChildren.has(c.id)
    const hasNoRelations = !referencedInRelations.has(c.id)

    if (isRoot && isLeaf && hasNoRelations) {
      defects.push({
        id: `orphan_class:class:${c.id}`,
        kind: "orphan_class",
        severity: "warning",
        targetType: "class",
        targetId: c.id,
        targetName: c.name,
        title: "Orphan class disconnected from taxonomy",
        description: `Class "${c.name}" has no superclass, no subclasses, and no incoming or outgoing relations. It sits completely isolated in the graph.`,
        suggestedAction: "Assign a parent class or connect with a relation, or remove if obsolete.",
        oopsPitfallId: "P04",
      })
    }
  }

  return defects
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function checkNearDuplicates(
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []

  // Classes
  const classGroups = new Map<string, OntologyClassWithAttributes[]>()
  for (const c of classes) {
    const key = normalizeKey(c.name)
    if (!key) continue
    const group = classGroups.get(key) ?? []
    group.push(c)
    classGroups.set(key, group)
  }

  for (const [, group] of classGroups) {
    if (group.length > 1) {
      for (const item of group) {
        const others = group.filter((o) => o.id !== item.id).map((o) => `"${o.name}"`)
        defects.push({
          id: `near_duplicate_class:class:${item.id}`,
          kind: "near_duplicate_class",
          severity: "warning",
          targetType: "class",
          targetId: item.id,
          targetName: item.name,
          title: "Near-duplicate class label",
          description: `Class "${item.name}" has a normalized name that collides with ${others.join(", ")}.`,
          suggestedAction: "Merge duplicate concepts or clarify distinction in naming.",
          oopsPitfallId: "P24",
        })
      }
    }
  }

  // Relations
  const relGroups = new Map<string, OntologyRelation[]>()
  for (const r of relations) {
    const key = normalizeKey(r.name)
    if (!key) continue
    const group = relGroups.get(key) ?? []
    group.push(r)
    relGroups.set(key, group)
  }

  for (const [, group] of relGroups) {
    if (group.length > 1) {
      for (const item of group) {
        const others = group.filter((o) => o.id !== item.id).map((o) => `"${o.name}"`)
        defects.push({
          id: `near_duplicate_relation:relation:${item.id}`,
          kind: "near_duplicate_relation",
          severity: "warning",
          targetType: "relation",
          targetId: item.id,
          targetName: item.name,
          title: "Near-duplicate relation name",
          description: `Relation "${item.name}" has a normalized name that collides with ${others.join(", ")}.`,
          suggestedAction: "Consolidate into a single relation or rename for clarity.",
          oopsPitfallId: "P24",
        })
      }
    }
  }

  return defects
}

const COMPETING_SUFFIXES = ["type", "kind", "category", "mode", "variant"]

export function checkCompetingPatterns(
  classes: OntologyClassWithAttributes[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []
  const childCountByParent = new Map<string, number>()

  for (const c of classes) {
    if (c.parent_class_id) {
      childCountByParent.set(
        c.parent_class_id,
        (childCountByParent.get(c.parent_class_id) ?? 0) + 1
      )
    }
  }

  const multiSubclassParents = classes.filter(
    (c) => (childCountByParent.get(c.id) ?? 0) >= 2
  )

  for (const parent of multiSubclassParents) {
    const normalizedParentName = normalizeKey(parent.name)

    for (const c of classes) {
      if (c.id === parent.id) continue
      const normName = normalizeKey(c.name)

      for (const suffix of COMPETING_SUFFIXES) {
        if (normName === `${normalizedParentName}${suffix}`) {
          defects.push({
            id: `competing_modelling_pattern:class:${c.id}`,
            kind: "competing_modelling_pattern",
            severity: "warning",
            targetType: "class",
            targetId: c.id,
            targetName: c.name,
            title: "Competing modeling pattern detected",
            description: `Class "${c.name}" coexists alongside parent class "${parent.name}", which already defines a subclass partition with multiple specialized classes. Using both an attribute class and a subclass partition creates modeling contradictions.`,
            suggestedAction: `Consolidate "${c.name}" into the existing subclass hierarchy or represent it as an attribute property.`,
            oopsPitfallId: "P28",
          })
          break
        }
      }
    }
  }

  return defects
}

export function checkInverseRelations(
  relations: OntologyRelation[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []

  for (const rel of relations) {
    const inverseName = rel.inverse_name?.trim()
    if (!inverseName) continue

    const normalizedInverse = normalizeKey(inverseName)

    const counterpart = relations.find((r) => {
      if (r.id === rel.id) return false
      return (
        normalizeKey(r.name) === normalizedInverse &&
        r.domain_class_id === rel.range_class_id &&
        r.range_class_id === rel.domain_class_id
      )
    })

    if (!counterpart) {
      defects.push({
        id: `inverse_inconsistent:relation:${rel.id}`,
        kind: "inverse_inconsistent",
        severity: "warning",
        targetType: "relation",
        targetId: rel.id,
        targetName: rel.name,
        title: "Missing inverse relation counterpart",
        description: `Relation "${rel.name}" declares inverse name "${inverseName}", but no corresponding reverse relation exists from range to domain.`,
        suggestedAction: "Create the reverse relation edge or remove the inverse annotation.",
        oopsPitfallId: "P11",
      })
    }
  }

  return defects
}

export function checkMetadataCompleteness(
  classes: OntologyClassWithAttributes[],
  relations: OntologyRelation[]
): OntologyDefect[] {
  const defects: OntologyDefect[] = []

  // Outgoing relations index
  const outgoingRelations = new Set<string>()
  for (const r of relations) {
    outgoingRelations.add(r.domain_class_id)
  }

  const hasChildren = new Set<string>()
  for (const c of classes) {
    if (c.parent_class_id) {
      hasChildren.add(c.parent_class_id)
    }
  }

  for (const c of classes) {
    if (!c.description || !c.description.trim()) {
      defects.push({
        id: `missing_description:class:${c.id}`,
        kind: "missing_description",
        severity: "info",
        targetType: "class",
        targetId: c.id,
        targetName: c.name,
        title: "Missing class description",
        description: `Class "${c.name}" has an empty description.`,
        suggestedAction: "Add a clear definition to improve documentation and entity clarity.",
        oopsPitfallId: "P08",
        quickFixType: "focus_description",
      })
    }

    if (
      classes.length > 1 &&
      !hasChildren.has(c.id) &&
      (!c.attributes || c.attributes.length === 0) &&
      !outgoingRelations.has(c.id)
    ) {
      defects.push({
        id: `class_without_attributes:class:${c.id}`,
        kind: "class_without_attributes",
        severity: "info",
        targetType: "class",
        targetId: c.id,
        targetName: c.name,
        title: "Class without attributes or outgoing relations",
        description: `Class "${c.name}" defines neither attributes nor outgoing relations.`,
        suggestedAction: "Attach properties or relations to ground this concept.",
        oopsPitfallId: "P04",
        quickFixType: "open_attributes",
      })
    }
  }

  for (const r of relations) {
    if (!r.description || !r.description.trim()) {
      defects.push({
        id: `missing_description:relation:${r.id}`,
        kind: "missing_description",
        severity: "info",
        targetType: "relation",
        targetId: r.id,
        targetName: r.name,
        title: "Missing relation description",
        description: `Relation "${r.name}" has an empty description.`,
        suggestedAction: "Add a clear description explaining the semantics of this predicate.",
        oopsPitfallId: "P08",
        quickFixType: "focus_description",
      })
    }
  }

  return defects
}
