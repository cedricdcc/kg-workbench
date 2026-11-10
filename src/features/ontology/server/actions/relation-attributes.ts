"use server"

import { revalidatePath } from "next/cache"

import type { OntologyRelationAttribute } from "@/domain/ontology"
import {
  DEFAULT_ONTOLOGY_DATA_TYPE,
  type OntologyDataTypeId,
} from "@/features/ontology/utils/data-types"
import { routes } from "@/lib/routes"
import { assertOntologyRecordAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyRelationAttributeSnapshot } from "../linkml/types"

export async function createRelationAttribute(
  relationId: string,
  data: {
    name: string
    dataType?: OntologyDataTypeId
    description?: string
    required?: boolean
    sortOrder?: number
  },
  explicitOntologyId?: string
): Promise<OntologyRelationAttribute> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_relations", relationId, db))

  const newAttrId = `${relationId}.${data.name.trim()}`
  let created: OntologyRelationAttributeSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.relation_attributes = draft.relation_attributes ?? []
      const exists = draft.relation_attributes.some(
        (ra) =>
          ra.relation_id === relationId &&
          ra.name.toLowerCase() === data.name.trim().toLowerCase()
      )
      if (exists) {
        throw new Error(
          `Relation attribute "${data.name.trim()}" already exists on relation "${relationId}".`
        )
      }

      created = {
        id: newAttrId,
        relation_id: relationId,
        name: data.name.trim(),
        data_type: data.dataType ?? DEFAULT_ONTOLOGY_DATA_TYPE,
        description: data.description ?? "",
        required: data.required ?? false,
        sort_order: data.sortOrder ?? 0,
      }

      draft.relation_attributes.push(created)
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }

  return {
    id: created?.id ?? newAttrId,
    relation_id: relationId,
    name: data.name.trim(),
    data_type: data.dataType ?? DEFAULT_ONTOLOGY_DATA_TYPE,
    description: data.description ?? "",
    required: data.required ?? false,
    sort_order: data.sortOrder ?? 0,
    created_at: new Date().toISOString(),
  }
}

export async function updateRelationAttribute(
  id: string,
  data: {
    name?: string
    dataType?: OntologyDataTypeId
    description?: string
    required?: boolean
    sortOrder?: number
  },
  explicitOntologyId?: string
): Promise<OntologyRelationAttribute> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_relation_attributes", id, db))

  let targetAttr: OntologyRelationAttributeSnapshot | undefined
  let diffOptions: { attributeRenames?: Record<string, string> } | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetAttr = draft.relation_attributes?.find(
        (ra) => ra.id === id || ra.name === id
      )
      if (!targetAttr) {
        throw new Error(`Relation attribute "${id}" was not found.`)
      }

      const oldKey = targetAttr.id

      if (data.name && data.name.trim() !== targetAttr.name) {
        const newName = data.name.trim()
        const newKey = `${targetAttr.relation_id}.${newName}`
        diffOptions = { attributeRenames: { [oldKey]: newKey } }
        targetAttr.name = newName
        targetAttr.id = newKey
      }

      if (data.dataType !== undefined) {
        targetAttr.data_type = data.dataType
      }
      if (data.description !== undefined) {
        targetAttr.description = data.description
      }
      if (data.required !== undefined) {
        targetAttr.required = data.required
      }
      if (data.sortOrder !== undefined) {
        targetAttr.sort_order = data.sortOrder
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
    id: targetAttr?.id ?? id,
    relation_id: targetAttr?.relation_id ?? "",
    name: targetAttr?.name ?? data.name ?? "",
    data_type: (targetAttr?.data_type ??
      data.dataType ??
      DEFAULT_ONTOLOGY_DATA_TYPE) as OntologyDataTypeId,
    description: targetAttr?.description ?? data.description ?? "",
    required: targetAttr?.required ?? data.required ?? false,
    sort_order: targetAttr?.sort_order ?? data.sortOrder ?? 0,
    created_at: new Date().toISOString(),
  }
}

export async function deleteRelationAttribute(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_relation_attributes", id, db))

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.relation_attributes = (draft.relation_attributes ?? []).filter(
        (ra) => ra.id !== id && ra.name !== id
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
