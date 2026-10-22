import { Parser as N3Parser, type Quad } from "n3"
import type {
  ImportClass,
  ImportExample,
  ImportOntology,
  ImportRelation,
} from "@/features/ontology/schemas/import"
import {
  DEFAULT_ONTOLOGY_DATA_TYPE,
  normalizeOntologyDataTypeOrDefault,
  type OntologyDataTypeId,
} from "@/features/ontology/utils/data-types"
import { KNOWN_ONTOLOGY_PREFIXES } from "@/features/ontology/utils/external-uri"
import { computeOntologyDagreLayout } from "./layout"
import type { ParseTurtleOptions } from "./types"

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first"
const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest"
const RDF_NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil"
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label"
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment"
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain"
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range"
const RDFS_SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf"
const SKOS_PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel"

const OWL_CLASS = "http://www.w3.org/2002/07/owl#Class"
const RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class"
const OWL_OBJECT_PROPERTY = "http://www.w3.org/2002/07/owl#ObjectProperty"
const OWL_DATATYPE_PROPERTY = "http://www.w3.org/2002/07/owl#DatatypeProperty"
const OWL_ONTOLOGY = "http://www.w3.org/2002/07/owl#Ontology"
const OWL_VERSION_IRI = "http://www.w3.org/2002/07/owl#versionIRI"
const OWL_VERSION_INFO = "http://www.w3.org/2002/07/owl#versionInfo"
const OWL_RESTRICTION = "http://www.w3.org/2002/07/owl#Restriction"
const OWL_ON_PROPERTY = "http://www.w3.org/2002/07/owl#onProperty"
const OWL_SOME_VALUES_FROM = "http://www.w3.org/2002/07/owl#someValuesFrom"
const OWL_ALL_VALUES_FROM = "http://www.w3.org/2002/07/owl#allValuesFrom"
const OWL_ON_CLASS = "http://www.w3.org/2002/07/owl#onClass"
const OWL_ON_DATA_RANGE = "http://www.w3.org/2002/07/owl#onDataRange"
const OWL_QUALIFIED_CARDINALITY =
  "http://www.w3.org/2002/07/owl#qualifiedCardinality"
const OWL_CARDINALITY = "http://www.w3.org/2002/07/owl#cardinality"
const OWL_MIN_QUALIFIED_CARDINALITY =
  "http://www.w3.org/2002/07/owl#minQualifiedCardinality"
const OWL_MAX_QUALIFIED_CARDINALITY =
  "http://www.w3.org/2002/07/owl#maxQualifiedCardinality"
const OWL_EQUIVALENT_CLASS = "http://www.w3.org/2002/07/owl#equivalentClass"
const OWL_ONE_OF = "http://www.w3.org/2002/07/owl#oneOf"
const OWL_NAMED_INDIVIDUAL = "http://www.w3.org/2002/07/owl#NamedIndividual"
const OWL_UNION_OF = "http://www.w3.org/2002/07/owl#unionOf"

const DC_DESCRIPTION = "http://purl.org/dc/elements/1.1/description"
const DCT_DESCRIPTION = "http://purl.org/dc/terms/description"
const VANN_PREFIX = "http://purl.org/vocab/vann/preferredNamespacePrefix"
const VANN_URI = "http://purl.org/vocab/vann/preferredNamespaceUri"

function normalizeIriDatatype(iri: string): OntologyDataTypeId {
  const xsdPrefix = "http://www.w3.org/2001/XMLSchema#"
  if (iri.startsWith(xsdPrefix)) {
    const local = iri.slice(xsdPrefix.length)
    return normalizeOntologyDataTypeOrDefault(`xsd:${local}`)
  }
  return normalizeOntologyDataTypeOrDefault(iri, DEFAULT_ONTOLOGY_DATA_TYPE)
}

function traverseRdfList(
  firstNode: string,
  quadsBySubject: Map<string, Quad[]>
): string[] {
  const items: string[] = []
  let current: string | undefined = firstNode

  while (current && current !== RDF_NIL) {
    const subjectQuads: Quad[] = quadsBySubject.get(current) ?? []
    const firstQuad = subjectQuads.find(
      (q: Quad) => q.predicate.value === RDF_FIRST
    )
    if (firstQuad) {
      items.push(firstQuad.object.value)
    }
    const restQuad = subjectQuads.find(
      (q: Quad) => q.predicate.value === RDF_REST
    )
    current = restQuad?.object.value
  }

  return items
}

export function parseTurtleToImportOntology(
  content: string,
  options: ParseTurtleOptions = {}
): ImportOntology {
  const parser = new N3Parser()
  const quads: Quad[] = parser.parse(content)
  const parsedPrefixes =
    (parser as unknown as { _prefixes?: Record<string, string> })._prefixes ||
    {}

  // Combine known prefixes with parsed prefixes
  const prefixMap: Record<string, string> = {
    obo: "http://purl.obolibrary.org/obo/",
    ...KNOWN_ONTOLOGY_PREFIXES,
    ...parsedPrefixes,
  }

  // Index quads by subject
  const quadsBySubject = new Map<string, Quad[]>()
  for (const q of quads) {
    const list = quadsBySubject.get(q.subject.value) ?? []
    list.push(q)
    quadsBySubject.set(q.subject.value, list)
  }

  // Detect owl:Ontology
  let ontologyIri = ""
  let ontologyName = ""
  let ontologyUsecase = ""
  let ontologyVersion: string | null = null
  let primaryNamespaceUri = ""
  let primaryPrefix = ""

  for (const q of quads) {
    if (q.predicate.value === RDF_TYPE && q.object.value === OWL_ONTOLOGY) {
      ontologyIri = q.subject.value
      break
    }
  }

  if (ontologyIri) {
    const ontQuads = quadsBySubject.get(ontologyIri) ?? []
    for (const q of ontQuads) {
      if (q.predicate.value === RDFS_LABEL && !ontologyName) {
        ontologyName = q.object.value
      } else if (
        (q.predicate.value === RDFS_COMMENT ||
          q.predicate.value === DC_DESCRIPTION ||
          q.predicate.value === DCT_DESCRIPTION) &&
        !ontologyUsecase
      ) {
        ontologyUsecase = q.object.value
      } else if (
        (q.predicate.value === OWL_VERSION_IRI ||
          q.predicate.value === OWL_VERSION_INFO) &&
        !ontologyVersion
      ) {
        ontologyVersion = q.object.value
      } else if (q.predicate.value === VANN_URI && !primaryNamespaceUri) {
        primaryNamespaceUri = q.object.value
      } else if (q.predicate.value === VANN_PREFIX && !primaryPrefix) {
        primaryPrefix = q.object.value
      }
    }
  }

  if (!primaryNamespaceUri && ontologyIri) {
    primaryNamespaceUri =
      ontologyIri.endsWith("#") || ontologyIri.endsWith("/")
        ? ontologyIri
        : `${ontologyIri}#`
  }

  if (!primaryPrefix && primaryNamespaceUri) {
    for (const [p, u] of Object.entries(prefixMap)) {
      if (u === primaryNamespaceUri || u === ontologyIri) {
        primaryPrefix = p
        break
      }
    }
  }

  if (!ontologyName) {
    if (options.fileName) {
      ontologyName = options.fileName.replace(/\.[^/.]+$/, "")
    } else if (ontologyIri) {
      const parts = ontologyIri.split(/[\/#]/).filter(Boolean)
      ontologyName = parts[parts.length - 1] ?? "Imported Ontology"
    } else {
      ontologyName = "Imported Ontology"
    }
  }

  const defaultModuleId = "default-module"
  const defaultModuleName = ontologyName

  // Helper to format CURIE or local name
  function resolveEntityName(iri: string): string {
    if (primaryNamespaceUri && iri.startsWith(primaryNamespaceUri)) {
      return iri.slice(primaryNamespaceUri.length)
    }
    for (const [prefix, base] of Object.entries(prefixMap)) {
      if (prefix && iri.startsWith(base)) {
        return `${prefix}:${iri.slice(base.length)}`
      }
    }
    const parts = iri.split(/[\/#]/).filter(Boolean)
    return parts[parts.length - 1] ?? iri
  }

  // 1. Identify Classes
  const classIriSet = new Set<string>()
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      (q.object.value === OWL_CLASS || q.object.value === RDFS_CLASS) &&
      q.subject.termType !== "BlankNode"
    ) {
      classIriSet.add(q.subject.value)
    }
  }

  const classByIri = new Map<string, ImportClass>()
  let classIndex = 0

  for (const classIri of classIriSet) {
    classIndex++
    const quadsForClass = quadsBySubject.get(classIri) ?? []
    let description = ""
    for (const q of quadsForClass) {
      if (q.predicate.value === RDFS_COMMENT) {
        description = q.object.value
        break
      }
    }

    const cls: ImportClass = {
      id: `cls-${classIndex}`,
      name: resolveEntityName(classIri),
      moduleId: defaultModuleId,
      module: defaultModuleName,
      description,
      parentClassId: null,
      attributes: [],
      restrictions: [],
    }

    classByIri.set(classIri, cls)
  }

  // 2. Identify Subclasses and Restrictions
  for (const [classIri, cls] of classByIri.entries()) {
    const quadsForClass = quadsBySubject.get(classIri) ?? []

    for (const q of quadsForClass) {
      if (q.predicate.value === RDFS_SUBCLASS_OF) {
        if (q.object.termType !== "BlankNode") {
          // Named class inheritance
          const parentCls = classByIri.get(q.object.value)
          if (parentCls && !cls.parentClassId) {
            cls.parentClassId = parentCls.id
          }
        } else {
          // Blank node restriction
          const targetIri = q.object.value
          const restQuads = quadsBySubject.get(targetIri) ?? []
          const isRestriction = restQuads.some(
            (rq) =>
              rq.predicate.value === RDF_TYPE &&
              rq.object.value === OWL_RESTRICTION
          )

          if (isRestriction) {
            let propIri = ""
            let cardinality: number | undefined
            let restType: NonNullable<
              ImportClass["restrictions"]
            >[number]["type"] = "exact"
            let targetRangeIri: string | undefined

            for (const rq of restQuads) {
              if (rq.predicate.value === OWL_ON_PROPERTY) {
                propIri = rq.object.value
              } else if (
                rq.predicate.value === OWL_QUALIFIED_CARDINALITY ||
                rq.predicate.value === OWL_CARDINALITY
              ) {
                cardinality = parseInt(rq.object.value, 10)
                restType = "exact"
              } else if (rq.predicate.value === OWL_MIN_QUALIFIED_CARDINALITY) {
                cardinality = parseInt(rq.object.value, 10)
                restType = "min"
              } else if (rq.predicate.value === OWL_MAX_QUALIFIED_CARDINALITY) {
                cardinality = parseInt(rq.object.value, 10)
                restType = "max"
              } else if (rq.predicate.value === OWL_SOME_VALUES_FROM) {
                targetRangeIri = rq.object.value
                restType = "some"
              } else if (rq.predicate.value === OWL_ALL_VALUES_FROM) {
                targetRangeIri = rq.object.value
                restType = "all"
              } else if (rq.predicate.value === OWL_ON_DATA_RANGE) {
                targetRangeIri = rq.object.value
              } else if (rq.predicate.value === OWL_ON_CLASS) {
                targetRangeIri = rq.object.value
              }
            }

            if (propIri) {
              cls.restrictions = cls.restrictions ?? []
              cls.restrictions.push({
                propertyIri: propIri,
                type: restType,
                cardinality: isNaN(cardinality as number)
                  ? undefined
                  : cardinality,
                targetIri: targetRangeIri,
              })

              // If it defines a data range, also attach/update class attribute
              if (
                targetRangeIri &&
                (targetRangeIri.includes("XMLSchema") ||
                  targetRangeIri.includes("shacl#IRI"))
              ) {
                const attrName = resolveEntityName(propIri)
                const existingAttr = cls.attributes.find(
                  (a) => a.name === attrName
                )
                if (existingAttr) {
                  existingAttr.required = (cardinality ?? 0) >= 1
                  existingAttr.dataType = normalizeIriDatatype(targetRangeIri)
                } else {
                  cls.attributes.push({
                    id: `attr-${cls.id}-${cls.attributes.length + 1}`,
                    name: attrName,
                    dataType: normalizeIriDatatype(targetRangeIri),
                    required: (cardinality ?? 0) >= 1,
                    description: "",
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  // 3. Extract Datatype Properties
  const datatypePropIris = new Set<string>()
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_DATATYPE_PROPERTY
    ) {
      datatypePropIris.add(q.subject.value)
    }
  }

  for (const propIri of datatypePropIris) {
    const pQuads = quadsBySubject.get(propIri) ?? []
    let rangeIri = "http://www.w3.org/2001/XMLSchema#string"
    const domainIris: string[] = []
    let comment = ""

    for (const q of pQuads) {
      if (q.predicate.value === RDFS_RANGE) {
        rangeIri = q.object.value
      } else if (q.predicate.value === RDFS_COMMENT) {
        comment = q.object.value
      } else if (q.predicate.value === RDFS_DOMAIN) {
        if (q.object.termType !== "BlankNode") {
          domainIris.push(q.object.value)
        } else {
          // Check for owl:unionOf on blank node
          const unionQuads = quadsBySubject.get(q.object.value) ?? []
          const unionListQuad = unionQuads.find(
            (uq) => uq.predicate.value === OWL_UNION_OF
          )
          if (unionListQuad) {
            domainIris.push(
              ...traverseRdfList(unionListQuad.object.value, quadsBySubject)
            )
          }
        }
      }
    }

    const attrName = resolveEntityName(propIri)
    const dataType = normalizeIriDatatype(rangeIri)

    for (const domainIri of domainIris) {
      const cls = classByIri.get(domainIri)
      if (cls) {
        const existingAttr = cls.attributes.find((a) => a.name === attrName)
        if (!existingAttr) {
          cls.attributes.push({
            id: `attr-${cls.id}-${cls.attributes.length + 1}`,
            name: attrName,
            dataType,
            required: false,
            description: comment,
          })
        }
      }
    }
  }

  // 4. Extract Object Properties & Relations
  const objectPropIris = new Set<string>()
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_OBJECT_PROPERTY
    ) {
      objectPropIris.add(q.subject.value)
    }
  }

  const relations: ImportRelation[] = []
  let relationIndex = 0

  for (const propIri of objectPropIris) {
    const pQuads = quadsBySubject.get(propIri) ?? []
    const domainIris: string[] = []
    const rangeIris: string[] = []
    let comment = ""

    for (const q of pQuads) {
      if (q.predicate.value === RDFS_DOMAIN) {
        if (q.object.termType !== "BlankNode") {
          domainIris.push(q.object.value)
        }
      } else if (q.predicate.value === RDFS_RANGE) {
        if (q.object.termType !== "BlankNode") {
          rangeIris.push(q.object.value)
        }
      } else if (q.predicate.value === RDFS_COMMENT) {
        comment = q.object.value
      }
    }

    const relName = resolveEntityName(propIri)

    for (const domainIri of domainIris) {
      for (const rangeIri of rangeIris) {
        const domainCls = classByIri.get(domainIri)
        const rangeCls = classByIri.get(rangeIri)
        if (domainCls && rangeCls) {
          relationIndex++
          relations.push({
            id: `rel-${relationIndex}`,
            name: relName,
            domainClassId: domainCls.id,
            rangeClassId: rangeCls.id,
            description: comment,
            inverseName: null,
            cardinality: null,
          })
        }
      }
    }
  }

  // 5. Extract Named Individuals & Enumerations
  const examples: ImportExample[] = []
  let exampleIndex = 0

  // Check owl:oneOf on classes
  for (const [classIri, cls] of classByIri.entries()) {
    const cQuads = quadsBySubject.get(classIri) ?? []
    for (const q of cQuads) {
      if (
        q.predicate.value === OWL_EQUIVALENT_CLASS &&
        q.object.termType === "BlankNode"
      ) {
        const eqQuads = quadsBySubject.get(q.object.value) ?? []
        for (const eqQ of eqQuads) {
          if (eqQ.predicate.value === OWL_ONE_OF) {
            const memberIris = traverseRdfList(eqQ.object.value, quadsBySubject)
            for (const memberIri of memberIris) {
              exampleIndex++
              examples.push({
                id: `ex-${exampleIndex}`,
                targetType: "class",
                targetId: cls.id,
                value: resolveEntityName(memberIri),
                isInstanceCandidate: true,
                sortOrder: exampleIndex,
              })
            }
          }
        }
      }
    }
  }

  // Check explicit owl:NamedIndividual
  for (const q of quads) {
    if (
      q.predicate.value === RDF_TYPE &&
      q.object.value === OWL_NAMED_INDIVIDUAL
    ) {
      const indIri = q.subject.value
      const indQuads = quadsBySubject.get(indIri) ?? []
      let label = ""

      for (const iq of indQuads) {
        if (
          iq.predicate.value === RDFS_LABEL ||
          iq.predicate.value === SKOS_PREF_LABEL
        ) {
          label = iq.object.value
          break
        }
      }
      if (!label) {
        label = resolveEntityName(indIri)
      }

      for (const iq of indQuads) {
        if (
          iq.predicate.value === RDF_TYPE &&
          iq.object.value !== OWL_NAMED_INDIVIDUAL
        ) {
          const targetClass = classByIri.get(iq.object.value)
          if (targetClass) {
            // Check if not already added by oneOf
            const alreadyAdded = examples.some(
              (e) => e.targetId === targetClass.id && e.value === label
            )
            if (!alreadyAdded) {
              exampleIndex++
              examples.push({
                id: `ex-${exampleIndex}`,
                targetType: "class",
                targetId: targetClass.id,
                value: label,
                isInstanceCandidate: true,
                sortOrder: exampleIndex,
              })
            }
          }
        }
      }
    }
  }

  const classes = Array.from(classByIri.values())
  const visual = computeOntologyDagreLayout(
    classes,
    relations,
    defaultModuleName,
    defaultModuleId
  )

  return {
    defaultLanguage: options.defaultLanguage ?? "en",
    languages: [{ code: options.defaultLanguage ?? "en", label: "English" }],
    name: ontologyName,
    usecase: ontologyUsecase,
    version: ontologyVersion,
    modules: [
      {
        id: defaultModuleId,
        name: defaultModuleName,
        description: ontologyUsecase,
      },
    ],
    classes,
    relations,
    relationAttributes: [],
    competencyQuestions: [],
    notes: [],
    examples,
    localizedTexts: [],
    visual,
  }
}
