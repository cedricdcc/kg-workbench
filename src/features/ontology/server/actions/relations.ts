"use server"

import { revalidatePath } from "next/cache"

import type { OntologyRelation } from "@/domain/ontology"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyRelationSnapshot } from "../linkml/types"

export async function createRelation(
  ontologyId: string,
  data: {
    name: string
    domainClassId: string
    rangeClassId: string
    description?: string
    inverseName?: string | null
    cardinality?: string | null
    localizedTexts?: Array<{
      fieldName: string
      languageCode: string
      value: string
    }>
  }
): Promise<OntologyRelation> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const relationId = data.name.trim()

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.relations = draft.relations ?? []
      const exists = draft.relations.some(
        (r) => r.name.toLowerCase() === relationId.toLowerCase()
      )
      if (exists) {
        throw new Error(`Relation "${relationId}" already exists.`)
      }

      const rel: OntologyRelationSnapshot = {
        id: relationId,
        name: relationId,
        domain_class_id: data.domainClassId,
        range_class_id: data.rangeClassId,
        description: data.description ?? "",
        inverse_name: data.inverseName ?? null,
        cardinality: data.cardinality ?? null,
        instance_policy: "open",
      }

      draft.relations.push(rel)

      if (data.localizedTexts && data.localizedTexts.length > 0) {
        draft.localized_texts = draft.localized_texts ?? []
        for (const lt of data.localizedTexts) {
          if (lt.value && lt.value.trim()) {
            draft.localized_texts.push({
              target_type: "relation",
              target_id: relationId,
              field_name: lt.fieldName,
              language_code: lt.languageCode,
              value: lt.value.trim(),
            })
          }
        }
      }
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return {
    id: relationId,
    ontology_id: ontologyId,
    name: relationId,
    domain_class_id: data.domainClassId,
    range_class_id: data.rangeClassId,
    description: data.description ?? "",
    inverse_name: data.inverseName ?? null,
    cardinality: data.cardinality ?? null,
    instance_policy: "open",
  }
}

export async function updateRelation(
  id: string,
  data: {
    name?: string
    domainClassId?: string
    rangeClassId?: string
    description?: string
    inverseName?: string | null
    cardinality?: string | null
    instancePolicy?: string
  },
  explicitOntologyId?: string
): Promise<OntologyRelation> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_relations",
    id,
    db,
    explicitOntologyId
  )

  let targetRel: OntologyRelationSnapshot | undefined
  const newName = data.name?.trim()

  const diffOptions =
    newName && newName !== id
      ? { relationRenames: { [id]: newName } }
      : undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetRel = draft.relations?.find((r) => r.id === id || r.name === id)
      if (!targetRel) {
        throw new Error(`Relation "${id}" not found.`)
      }

      const oldKey = targetRel.id

      if (newName && newName !== oldKey) {
        targetRel.id = newName
        targetRel.name = newName

        // Update relation attributes
        if (draft.relation_attributes) {
          for (const ra of draft.relation_attributes) {
            if (ra.relation_id === oldKey) {
              ra.relation_id = newName
              ra.id = `${newName}.${ra.name}`
            }
          }
        }
      }

      if (data.domainClassId !== undefined) {
        targetRel.domain_class_id = data.domainClassId
      }
      if (data.rangeClassId !== undefined) {
        targetRel.range_class_id = data.rangeClassId
      }
      if (data.description !== undefined) {
        targetRel.description = data.description
      }
      if (data.inverseName !== undefined) {
        targetRel.inverse_name = data.inverseName
      }
      if (data.cardinality !== undefined) {
        targetRel.cardinality = data.cardinality
      }
      if (data.instancePolicy !== undefined) {
        targetRel.instance_policy = data.instancePolicy
      }
    },
    { db, diffOptions }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return {
    id: targetRel?.id ?? newName ?? id,
    ontology_id: ontologyId,
    name: targetRel?.name ?? newName ?? id,
    domain_class_id: targetRel?.domain_class_id ?? data.domainClassId ?? "",
    range_class_id: targetRel?.range_class_id ?? data.rangeClassId ?? "",
    description: targetRel?.description ?? data.description ?? "",
    inverse_name: targetRel?.inverse_name ?? data.inverseName ?? null,
    cardinality: targetRel?.cardinality ?? data.cardinality ?? null,
    instance_policy:
      targetRel?.instance_policy ?? data.instancePolicy ?? "open",
  }
}

export async function deleteRelation(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_relations",
    id,
    db,
    explicitOntologyId
  )

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.relations = (draft.relations ?? []).filter(
        (r) => r.id !== id && r.name !== id
      )
      draft.relation_attributes = (draft.relation_attributes ?? []).filter(
        (ra) => ra.relation_id !== id
      )
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
}
