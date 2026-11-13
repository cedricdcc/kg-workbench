import { Parser as N3Parser, type Quad } from "n3"
import type { ImportOntology } from "@/features/ontology/schemas/import"
import type {
  ShaclValidationReport,
  ShaclValidationResult,
  ValidateTriplesInput,
} from "./types"

const RDFS_SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf"
const RDFS_SUBPROPERTY_OF =
  "http://www.w3.org/2000/01/rdf-schema#subPropertyOf"
const SHACL_TARGET_CLASS = "http://www.w3.org/ns/shacl#targetClass"
const SHACL_PROPERTY = "http://www.w3.org/ns/shacl#property"
const SHACL_PATH = "http://www.w3.org/ns/shacl#path"
const SHACL_MIN_COUNT = "http://www.w3.org/ns/shacl#minCount"

type OntologyClass = NonNullable<ImportOntology["classes"]>[number]
type OntologyRelation = NonNullable<ImportOntology["relations"]>[number]

interface ShaclMinCountConstraint {
  targetClassKey: string
  targetClassName: string
  path: string
  pathLocalName: string
  sourceShape: string
}

function extractLocalName(value: string): string {
  const hashIdx = value.lastIndexOf("#")
  if (hashIdx !== -1 && hashIdx < value.length - 1) {
    return value.slice(hashIdx + 1)
  }
  const slashIdx = value.lastIndexOf("/")
  if (slashIdx !== -1 && slashIdx < value.length - 1) {
    return value.slice(slashIdx + 1)
  }
  return value
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function termKey(term: Quad["subject"] | Quad["object"]): string {
  return term.termType === "BlankNode" ? `_:${term.value}` : term.value
}

function safeParseQuads(turtle?: string): Quad[] {
  if (!turtle || !turtle.trim()) {
    return []
  }
  try {
    return new N3Parser().parse(turtle)
  } catch {
    return []
  }
}

function addParentEdge(
  map: Map<string, Set<string>>,
  child: string,
  parent: string
): void {
  const childKey = normalizeKey(child)
  const parentKey = normalizeKey(parent)
  if (!childKey || !parentKey || childKey === parentKey) {
    return
  }
  let parents = map.get(childKey)
  if (!parents) {
    parents = new Set<string>()
    map.set(childKey, parents)
  }
  parents.add(parentKey)
}

function buildClassParentMap(
  classes: OntologyClass[],
  classByNameOrId: Map<string, OntologyClass>,
  rdfsQuads: Quad[]
): Map<string, Set<string>> {
  const parentMap = new Map<string, Set<string>>()

  for (const cls of classes) {
    if (!cls.parentClassId) continue
    const parentCls =
      classByNameOrId.get(cls.parentClassId) ||
      classByNameOrId.get(normalizeKey(cls.parentClassId))

    const childKeys = [cls.name, ...(cls.id ? [cls.id] : [])]
    const parentKeys = parentCls
      ? [parentCls.name, ...(parentCls.id ? [parentCls.id] : [])]
      : [cls.parentClassId]

    for (const childKey of childKeys) {
      for (const parentKey of parentKeys) {
        addParentEdge(parentMap, childKey, parentKey)
      }
    }
  }

  for (const quad of rdfsQuads) {
    if (quad.predicate.value !== RDFS_SUBCLASS_OF) continue
    const child = quad.subject.value
    const parent = quad.object.value
    addParentEdge(parentMap, child, parent)
    addParentEdge(parentMap, extractLocalName(child), extractLocalName(parent))
  }

  return parentMap
}

function buildPropertyParentMap(rdfsQuads: Quad[]): Map<string, Set<string>> {
  const parentMap = new Map<string, Set<string>>()

  for (const quad of rdfsQuads) {
    if (quad.predicate.value !== RDFS_SUBPROPERTY_OF) continue
    const child = quad.subject.value
    const parent = quad.object.value
    addParentEdge(parentMap, child, parent)
    addParentEdge(parentMap, extractLocalName(child), extractLocalName(parent))
  }

  return parentMap
}

function getHierarchyClosure(
  identifier: string,
  parentMap: Map<string, Set<string>>
): Set<string> {
  const closure = new Set<string>()
  const queue: string[] = [
    normalizeKey(identifier),
    normalizeKey(extractLocalName(identifier)),
  ]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || closure.has(current)) continue
    closure.add(current)

    const parents = parentMap.get(current)
    if (parents) {
      for (const parent of parents) {
        if (!closure.has(parent)) {
          queue.push(parent)
        }
      }
    }
  }

  return closure
}

function isClassOrSubclass(
  actualClass: string,
  expectedClass: OntologyClass,
  parentMap: Map<string, Set<string>>
): boolean {
  const closure = getHierarchyClosure(actualClass, parentMap)
  if (closure.has(normalizeKey(expectedClass.name))) {
    return true
  }
  if (expectedClass.id && closure.has(normalizeKey(expectedClass.id))) {
    return true
  }
  return false
}

function resolveRelation(
  relationText: string,
  relationByNameOrId: Map<string, OntologyRelation>,
  propertyParentMap: Map<string, Set<string>>
): OntologyRelation | undefined {
  const direct =
    relationByNameOrId.get(relationText) ||
    relationByNameOrId.get(normalizeKey(relationText)) ||
    relationByNameOrId.get(extractLocalName(relationText)) ||
    relationByNameOrId.get(normalizeKey(extractLocalName(relationText)))

  if (direct) {
    return direct
  }

  const closure = getHierarchyClosure(relationText, propertyParentMap)
  for (const candidate of closure) {
    const match = relationByNameOrId.get(candidate)
    if (match) {
      return match
    }
  }
  return undefined
}

function collectInheritedRequiredAttributes(
  subjectClass: OntologyClass,
  classByNameOrId: Map<string, OntologyClass>,
  classParentMap: Map<string, Set<string>>
): Array<{ name: string; ownerClassName: string }> {
  const requiredAttrs: Array<{ name: string; ownerClassName: string }> = []
  const seenAttrNames = new Set<string>()
  const closure = getHierarchyClosure(subjectClass.name, classParentMap)
  if (subjectClass.id) {
    for (const key of getHierarchyClosure(subjectClass.id, classParentMap)) {
      closure.add(key)
    }
  }

  const visitedClasses = new Set<string>()
  for (const classKey of closure) {
    const cls = classByNameOrId.get(classKey)
    if (!cls) continue
    const canonicalClassKey = cls.id ?? cls.name
    if (visitedClasses.has(canonicalClassKey)) continue
    visitedClasses.add(canonicalClassKey)

    for (const attr of cls.attributes ?? []) {
      if (!attr.required) continue
      if (seenAttrNames.has(attr.name)) continue
      seenAttrNames.add(attr.name)
      requiredAttrs.push({ name: attr.name, ownerClassName: cls.name })
    }
  }

  return requiredAttrs
}

function parseShaclMinCountConstraints(
  shaclTtl?: string
): ShaclMinCountConstraint[] {
  const quads = safeParseQuads(shaclTtl)
  if (quads.length === 0) {
    return []
  }

  const quadsBySubject = new Map<string, Quad[]>()
  for (const quad of quads) {
    const key = termKey(quad.subject)
    let list = quadsBySubject.get(key)
    if (!list) {
      list = []
      quadsBySubject.set(key, list)
    }
    list.push(quad)
  }

  const constraints: ShaclMinCountConstraint[] = []

  for (const [shapeKey, shapeQuads] of quadsBySubject.entries()) {
    const targetClasses = shapeQuads
      .filter((q) => q.predicate.value === SHACL_TARGET_CLASS)
      .map((q) => q.object.value)

    if (targetClasses.length === 0) continue

    const propertyShapeKeys = shapeQuads
      .filter((q) => q.predicate.value === SHACL_PROPERTY)
      .map((q) => termKey(q.object))

    for (const propShapeKey of propertyShapeKeys) {
      const propQuads = quadsBySubject.get(propShapeKey) ?? []
      const pathQuad = propQuads.find((q) => q.predicate.value === SHACL_PATH)
      const minCountQuad = propQuads.find(
        (q) => q.predicate.value === SHACL_MIN_COUNT
      )

      if (!pathQuad || !minCountQuad) continue
      const minCount = Number.parseInt(minCountQuad.object.value, 10)
      if (!Number.isFinite(minCount) || minCount < 1) continue

      const pathValue = pathQuad.object.value
      const pathLocalName = extractLocalName(pathValue)
      const sourceShape = extractLocalName(shapeKey)

      for (const targetClass of targetClasses) {
        const targetClassName = extractLocalName(targetClass)
        constraints.push({
          targetClassKey: normalizeKey(targetClassName),
          targetClassName,
          path: pathValue,
          pathLocalName,
          sourceShape,
        })
      }
    }
  }

  return constraints
}

function isMissingAttributeValue(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}

export function validateTriplesAgainstShacl({
  triples,
  ontology,
  rdfsTtl,
  shaclTtl,
}: ValidateTriplesInput): ShaclValidationReport {
  const classes = ontology.classes ?? []
  const relations = ontology.relations ?? []

  const classByNameOrId = new Map<string, OntologyClass>(
    classes.flatMap((c) => {
      const entries: [string, OntologyClass][] = [
        [c.name, c],
        [normalizeKey(c.name), c],
      ]
      if (c.id) {
        entries.push([c.id, c], [normalizeKey(c.id), c])
      }
      return entries
    })
  )

  const relationByNameOrId = new Map<string, OntologyRelation>(
    relations.flatMap((r) => {
      const entries: [string, OntologyRelation][] = [
        [r.name, r],
        [normalizeKey(r.name), r],
      ]
      if (r.id) {
        entries.push([r.id, r], [normalizeKey(r.id), r])
      }
      return entries
    })
  )

  const rdfsQuads = safeParseQuads(rdfsTtl)
  const classParentMap = buildClassParentMap(
    classes,
    classByNameOrId,
    rdfsQuads
  )
  const propertyParentMap = buildPropertyParentMap(rdfsQuads)
  const shaclConstraints = parseShaclMinCountConstraints(shaclTtl)

  const results: ShaclValidationResult[] = []

  for (const triple of triples) {
    const subjectClass = triple.subjectClass
      ? classByNameOrId.get(triple.subjectClass) ||
        classByNameOrId.get(normalizeKey(triple.subjectClass))
      : null

    const relation = resolveRelation(
      triple.relationText,
      relationByNameOrId,
      propertyParentMap
    )

    // 1. Validate domain and range conformity with RDFS subClassOf closure
    if (relation) {
      const expectedDomainClass =
        classByNameOrId.get(relation.domainClassId) ||
        classByNameOrId.get(normalizeKey(relation.domainClassId))
      if (
        expectedDomainClass &&
        triple.subjectClass &&
        !isClassOrSubclass(
          triple.subjectClass,
          expectedDomainClass,
          classParentMap
        )
      ) {
        results.push({
          focusNode: triple.subjectText,
          resultPath: triple.relationText,
          value: triple.subjectText,
          resultSeverity: "Violation",
          resultMessage: `Subject "${triple.subjectText}" of type "${triple.subjectClass}" does not conform to expected class domain "${expectedDomainClass.name}".`,
          sourceShape: `${expectedDomainClass.name}Shape`,
        })
      }

      const expectedRangeClass =
        classByNameOrId.get(relation.rangeClassId) ||
        classByNameOrId.get(normalizeKey(relation.rangeClassId))
      if (
        expectedRangeClass &&
        triple.objectClass &&
        !isClassOrSubclass(
          triple.objectClass,
          expectedRangeClass,
          classParentMap
        )
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

    // 2. Validate required attributes on subject class (including inherited attributes)
    const suppliedAttributes = triple.attributes ?? {}
    const coveredRequiredAttrNames = new Set<string>()

    if (subjectClass) {
      const requiredAttributes = collectInheritedRequiredAttributes(
        subjectClass,
        classByNameOrId,
        classParentMap
      )

      for (const reqAttr of requiredAttributes) {
        coveredRequiredAttrNames.add(reqAttr.name)
        coveredRequiredAttrNames.add(normalizeKey(reqAttr.name))
        const val = suppliedAttributes[reqAttr.name]
        if (isMissingAttributeValue(val)) {
          results.push({
            focusNode: triple.subjectText,
            resultPath: reqAttr.name,
            resultSeverity: "Violation",
            resultMessage: `Required property "${reqAttr.name}" on class "${subjectClass.name}" (from "${reqAttr.ownerClassName}") has minCount 1 but is missing.`,
            sourceShape: `${subjectClass.name}Shape`,
          })
        }
      }
    }

    // 3. Enforce additional shaclTtl minCount >= 1 constraints not already covered
    if (triple.subjectClass && shaclConstraints.length > 0) {
      const subjectClosure = getHierarchyClosure(
        triple.subjectClass,
        classParentMap
      )
      for (const constraint of shaclConstraints) {
        if (!subjectClosure.has(constraint.targetClassKey)) continue
        if (
          coveredRequiredAttrNames.has(constraint.pathLocalName) ||
          coveredRequiredAttrNames.has(normalizeKey(constraint.pathLocalName)) ||
          coveredRequiredAttrNames.has(constraint.path)
        ) {
          continue
        }

        const val =
          suppliedAttributes[constraint.path] ??
          suppliedAttributes[constraint.pathLocalName]

        if (isMissingAttributeValue(val)) {
          coveredRequiredAttrNames.add(constraint.pathLocalName)
          results.push({
            focusNode: triple.subjectText,
            resultPath: constraint.pathLocalName,
            resultSeverity: "Violation",
            resultMessage: `SHACL constraint on "${constraint.targetClassName}" requires "${constraint.pathLocalName}" (minCount 1) but it is missing.`,
            sourceShape: constraint.sourceShape,
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
