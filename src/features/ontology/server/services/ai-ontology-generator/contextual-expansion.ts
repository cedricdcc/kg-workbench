export type ContextualReferenceTerm = {
  curie: string
  iri: string
  label: string
  parentIris?: string[]
  relatedPropertyIris?: string[]
}

export type ContextualExpansionResult = {
  suggestedParents: Array<{ curie: string; iri: string; label: string }>
  suggestedProperties: Array<{ curie: string; iri: string; label: string }>
}

export function expandContextualConnections(
  adoptedCurieList: string[],
  catalog: ContextualReferenceTerm[]
): ContextualExpansionResult {
  const termByIri = new Map<string, ContextualReferenceTerm>()
  const termByCurie = new Map<string, ContextualReferenceTerm>()

  for (const item of catalog) {
    if (item.iri) termByIri.set(item.iri.toLowerCase(), item)
    if (item.curie) termByCurie.set(item.curie.toLowerCase(), item)
  }

  const suggestedParents: Array<{ curie: string; iri: string; label: string }> = []
  const suggestedProperties: Array<{ curie: string; iri: string; label: string }> = []
  const visitedParents = new Set<string>()
  const visitedProperties = new Set<string>()

  for (const curie of adoptedCurieList) {
    const term = termByCurie.get(curie.toLowerCase())
    if (!term) continue

    // Collect direct parent classes
    if (term.parentIris) {
      for (const parentIri of term.parentIris) {
        const parentLower = parentIri.toLowerCase()
        if (visitedParents.has(parentLower)) continue
        visitedParents.add(parentLower)

        const parentTerm = termByIri.get(parentLower)
        if (parentTerm) {
          suggestedParents.push({
            curie: parentTerm.curie,
            iri: parentTerm.iri,
            label: parentTerm.label || parentTerm.curie,
          })
        }
      }
    }

    // Collect related properties
    if (term.relatedPropertyIris) {
      for (const propIri of term.relatedPropertyIris) {
        const propLower = propIri.toLowerCase()
        if (visitedProperties.has(propLower)) continue
        visitedProperties.add(propLower)

        const propTerm = termByIri.get(propLower)
        if (propTerm) {
          suggestedProperties.push({
            curie: propTerm.curie,
            iri: propTerm.iri,
            label: propTerm.label || propTerm.curie,
          })
        }
      }
    }
  }

  return { suggestedParents, suggestedProperties }
}
