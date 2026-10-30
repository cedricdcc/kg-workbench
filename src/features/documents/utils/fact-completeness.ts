import type { EntityWithAttributes } from "@/domain/documents"

import type {
  DocumentOntology,
  DocumentOntologyAttribute,
  DocumentOntologyRelationAttribute,
  FactWithAnchors,
} from "../server/queries"

export interface MissingEntityAttribute {
  entityId: string
  entityText: string
  attribute: DocumentOntologyAttribute
}

export interface ShaclViolation {
  rule: "range" | "domain" | "required_attribute"
  message: string
}

export interface FactCompletenessResult {
  missingRelationAttributes: DocumentOntologyRelationAttribute[]
  missingSubjectAttributes: MissingEntityAttribute[]
  missingObjectAttributes: MissingEntityAttribute[]
  shaclViolations: ShaclViolation[]
  isComplete: boolean
}

export type FactCompletenessOntology =
  | (Pick<DocumentOntology, "attributes" | "relationAttributes"> &
      Partial<Pick<DocumentOntology, "classes" | "relations">>)
  | null
  | undefined

export function getEntityMissingRequiredAttributes(
  entity: EntityWithAttributes | null | undefined,
  ontologyAttributes: DocumentOntology["attributes"]
): DocumentOntologyAttribute[] {
  if (!entity?.class_id) return []

  const assignedAttributeIds = new Set(
    entity.attributes.map((attribute) => attribute.attribute_id)
  )

  return ontologyAttributes.filter(
    (attribute) =>
      attribute.classId === entity.class_id &&
      attribute.required &&
      !assignedAttributeIds.has(attribute.id)
  )
}

export function getFactCompleteness(
  fact: FactWithAnchors,
  ontology: FactCompletenessOntology,
  entitiesById: Map<string, EntityWithAttributes>
): FactCompletenessResult {
  if (!ontology) {
    return {
      missingRelationAttributes: [],
      missingSubjectAttributes: [],
      missingObjectAttributes: [],
      shaclViolations: [],
      isComplete: true,
    }
  }

  const factRelationAttributeIds = new Set(
    fact.relation_attribute_values.map((value) => value.relation_attribute_id)
  )
  const missingRelationAttributes =
    fact.relation_type_id === null
      ? []
      : ontology.relationAttributes.filter(
          (attribute) =>
            attribute.relationId === fact.relation_type_id &&
            attribute.required &&
            !factRelationAttributeIds.has(attribute.id)
        )

  const subjectEntity = fact.subject_entity_id
    ? (entitiesById.get(fact.subject_entity_id) ?? null)
    : null
  const objectEntity = fact.object_entity_id
    ? (entitiesById.get(fact.object_entity_id) ?? null)
    : null

  const missingSubjectAttributes = getEntityMissingRequiredAttributes(
    subjectEntity,
    ontology.attributes
  ).map((attribute) => ({
    entityId: subjectEntity!.id,
    entityText: subjectEntity!.entity_text,
    attribute,
  }))
  const missingObjectAttributes = getEntityMissingRequiredAttributes(
    objectEntity,
    ontology.attributes
  ).map((attribute) => ({
    entityId: objectEntity!.id,
    entityText: objectEntity!.entity_text,
    attribute,
  }))

  const shaclViolations: ShaclViolation[] = []

  // Check required attributes
  for (const missing of missingRelationAttributes) {
    shaclViolations.push({
      rule: "required_attribute",
      message: `Relation attribute "${missing.name}" is required.`,
    })
  }
  for (const missing of missingSubjectAttributes) {
    shaclViolations.push({
      rule: "required_attribute",
      message: `Subject "${missing.entityText}" is missing required attribute "${missing.attribute.name}".`,
    })
  }
  for (const missing of missingObjectAttributes) {
    shaclViolations.push({
      rule: "required_attribute",
      message: `Object "${missing.entityText}" is missing required attribute "${missing.attribute.name}".`,
    })
  }

  // Check domain and range class constraints against SHACL shape definitions
  if (fact.relation_type_id && ontology.relations) {
    const relation = ontology.relations.find(
      (r) => r.id === fact.relation_type_id
    )
    if (relation) {
      if (
        fact.subject_class_id &&
        relation.domain_class_id &&
        fact.subject_class_id !== relation.domain_class_id
      ) {
        const expectedDomain =
          ontology.classes?.find((c) => c.id === relation.domain_class_id)
            ?.name ?? relation.domain_class_id
        const actualDomain =
          ontology.classes?.find((c) => c.id === fact.subject_class_id)?.name ??
          fact.subject_class_id
        shaclViolations.push({
          rule: "domain",
          message: `Domain class "${expectedDomain}" expected for relation "${relation.name}", but subject is assigned to "${actualDomain}".`,
        })
      }

      if (
        fact.object_class_id &&
        relation.range_class_id &&
        fact.object_class_id !== relation.range_class_id
      ) {
        const expectedRange =
          ontology.classes?.find((c) => c.id === relation.range_class_id)
            ?.name ?? relation.range_class_id
        const actualRange =
          ontology.classes?.find((c) => c.id === fact.object_class_id)?.name ??
          fact.object_class_id
        shaclViolations.push({
          rule: "range",
          message: `Range class "${expectedRange}" expected for relation "${relation.name}", but object is assigned to "${actualRange}".`,
        })
      }
    }
  }

  return {
    missingRelationAttributes,
    missingSubjectAttributes,
    missingObjectAttributes,
    shaclViolations,
    isComplete:
      missingRelationAttributes.length === 0 &&
      missingSubjectAttributes.length === 0 &&
      missingObjectAttributes.length === 0 &&
      shaclViolations.length === 0,
  }
}
