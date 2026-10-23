import type { GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"

/**
 * Validates and auto-heals an AI-generated ontology draft before persistence or client consumption.
 * - Breaks direct and transitive cycles in class hierarchy links (e.g. A -> A, A -> B -> A).
 * - Removes dangling relation references where the domain or range class is missing.
 */
export function autoHealOntologyDraft(
  draft: GeneratedOntologyDraft,
  existingClasses: Array<{ id?: string; name: string }> = []
): { draft: GeneratedOntologyDraft; healedIssues: string[] } {
  const healedIssues: string[] = []
  const clonedDraft: GeneratedOntologyDraft = {
    ...draft,
    modules: [...draft.modules],
    classes: draft.classes.map((cls) => ({
      ...cls,
      attributes: cls.attributes ? [...cls.attributes] : [],
    })),
    relations: draft.relations.map((rel) => ({ ...rel })),
    cqMappings: draft.cqMappings.map((cq) => ({ ...cq })),
    suggestedContext: [...(draft.suggestedContext ?? [])],
  }

  // 1. Break cycles in class hierarchy
  const classByName = new Map<string, (typeof clonedDraft.classes)[0]>()
  for (const cls of clonedDraft.classes) {
    classByName.set(cls.name.toLowerCase(), cls)
  }

  for (const cls of clonedDraft.classes) {
    if (!cls.parentClassName) continue

    const visited = new Set<string>()
    visited.add(cls.name.toLowerCase())

    let parentName: string | null | undefined =
      cls.parentClassName.toLowerCase()
    let isCyclic = false

    while (parentName) {
      if (visited.has(parentName)) {
        isCyclic = true
        break
      }
      visited.add(parentName)
      const parentCls = classByName.get(parentName)
      parentName = parentCls?.parentClassName?.toLowerCase()
    }

    if (isCyclic) {
      const origParent = cls.parentClassName
      cls.parentClassName = null
      healedIssues.push(
        `Cleared cyclic parent link on class "${cls.name}" (points to "${origParent}").`
      )
    }
  }

  // 2. Filter dangling relations
  const validClassNames = new Set<string>()
  for (const c of existingClasses) {
    validClassNames.add(c.name.toLowerCase())
  }
  for (const c of clonedDraft.classes) {
    validClassNames.add(c.name.toLowerCase())
  }
  if (clonedDraft.suggestedContext) {
    for (const ctx of clonedDraft.suggestedContext) {
      if (ctx.type === "parentClass") {
        validClassNames.add((ctx.label || ctx.curie).toLowerCase())
        validClassNames.add(ctx.curie.toLowerCase())
      }
    }
  }

  clonedDraft.relations = clonedDraft.relations.filter((rel) => {
    const domainLower = rel.domainClassName.toLowerCase()
    const rangeLower = rel.rangeClassName.toLowerCase()
    const domainValid = validClassNames.has(domainLower)
    const rangeValid = validClassNames.has(rangeLower)

    if (!domainValid || !rangeValid) {
      const missing =
        !domainValid && !rangeValid
          ? `domain "${rel.domainClassName}" and range "${rel.rangeClassName}" do not exist`
          : !domainValid
            ? `domain "${rel.domainClassName}" does not exist`
            : `range "${rel.rangeClassName}" does not exist`

      healedIssues.push(`Removed dangling relation "${rel.name}": ${missing}.`)
      return false
    }
    return true
  })

  // 3. Auto-heal missing classes & relations referenced in CQ multi-triple mappings
  const defaultModuleName = clonedDraft.modules[0]?.name ?? "Core"
  if (clonedDraft.modules.length === 0) {
    clonedDraft.modules.push({ name: "Core", description: "Default module" })
  }

  const existingRelKeys = new Set(
    clonedDraft.relations.map(
      (r) =>
        `${r.name.toLowerCase()}:${r.domainClassName.toLowerCase()}:${r.rangeClassName.toLowerCase()}`
    )
  )

  for (const mapping of clonedDraft.cqMappings) {
    for (const t of mapping.triples ?? []) {
      const subLower = t.subjectClassName.toLowerCase()
      const objLower = t.objectClassName.toLowerCase()

      if (!validClassNames.has(subLower)) {
        clonedDraft.classes.push({
          name: t.subjectClassName,
          description: `Auto-generated from CQ mapping`,
          moduleName: mapping.moduleNames[0] || defaultModuleName,
          attributes: [],
        })
        validClassNames.add(subLower)
        healedIssues.push(
          `Synthesized missing class "${t.subjectClassName}" referenced in CQ mapping.`
        )
      }

      if (!validClassNames.has(objLower)) {
        clonedDraft.classes.push({
          name: t.objectClassName,
          description: `Auto-generated from CQ mapping`,
          moduleName: mapping.moduleNames[0] || defaultModuleName,
          attributes: [],
        })
        validClassNames.add(objLower)
        healedIssues.push(
          `Synthesized missing class "${t.objectClassName}" referenced in CQ mapping.`
        )
      }

      const relKey = `${t.predicateRelationName.toLowerCase()}:${subLower}:${objLower}`
      if (!existingRelKeys.has(relKey)) {
        clonedDraft.relations.push({
          name: t.predicateRelationName,
          description: `Auto-generated from CQ mapping`,
          domainClassName: t.subjectClassName,
          rangeClassName: t.objectClassName,
        })
        existingRelKeys.add(relKey)
        healedIssues.push(
          `Synthesized missing relation "${t.predicateRelationName}" connecting "${t.subjectClassName}" -> "${t.objectClassName}".`
        )
      }
    }
  }

  return { draft: clonedDraft, healedIssues }
}
