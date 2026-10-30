import type {
  ShaclValidationReport,
  ShaclValidationResult,
  ValidateTriplesInput,
} from "./types"

export function validateTriplesAgainstShacl({
  triples,
  ontology,
}: ValidateTriplesInput): ShaclValidationReport {
  const classes = ontology.classes ?? []
  const relations = ontology.relations ?? []

  const classByNameOrId = new Map(
    classes.flatMap((c) => {
      const entries: [string, typeof c][] = [
        [c.name, c],
        [c.name.toLowerCase(), c],
      ]
      if (c.id) entries.push([c.id, c])
      return entries
    })
  )

  const relationByNameOrId = new Map(
    relations.flatMap((r) => {
      const entries: [string, typeof r][] = [
        [r.name, r],
        [r.name.toLowerCase(), r],
      ]
      if (r.id) entries.push([r.id, r])
      return entries
    })
  )

  const results: ShaclValidationResult[] = []

  for (const triple of triples) {
    const subjectClass = triple.subjectClass
      ? classByNameOrId.get(triple.subjectClass) ||
        classByNameOrId.get(triple.subjectClass.toLowerCase())
      : null

    const relation =
      relationByNameOrId.get(triple.relationText) ||
      relationByNameOrId.get(triple.relationText.toLowerCase())

    // 1. If relation has defined range class, validate range conformity
    if (relation) {
      const expectedRangeClass = classByNameOrId.get(relation.rangeClassId)
      if (expectedRangeClass) {
        if (
          triple.objectClass &&
          triple.objectClass !== expectedRangeClass.name &&
          triple.objectClass !== expectedRangeClass.id
        ) {
          results.push({
            focusNode: triple.subjectText,
            resultPath: triple.relationText,
            value: triple.objectText,
            resultSeverity: "Violation",
            resultMessage: `Object "${triple.objectText}" of type "${triple.objectClass}" does not conform to expected class range "${expectedRangeClass.name}".`,
            sourceShape: `${expectedRangeClass.name}Shape`,
          })
        }
      }
    }

    // 2. Validate required attributes on subject class
    if (subjectClass) {
      const requiredAttributes = (subjectClass.attributes ?? []).filter(
        (a) => a.required
      )
      const suppliedAttributes = triple.attributes ?? {}

      for (const reqAttr of requiredAttributes) {
        const val = suppliedAttributes[reqAttr.name]
        if (val === undefined || val === null || val === "") {
          results.push({
            focusNode: triple.subjectText,
            resultPath: reqAttr.name,
            resultSeverity: "Violation",
            resultMessage: `Required property "${reqAttr.name}" on class "${subjectClass.name}" has minCount 1 but is missing.`,
            sourceShape: `${subjectClass.name}Shape`,
          })
        }
      }
    }
  }

  return {
    conforms: results.length === 0,
    results,
    targetShapesCount: classes.length,
  }
}
