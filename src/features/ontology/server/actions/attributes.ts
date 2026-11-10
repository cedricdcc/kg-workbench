"use server"

import { revalidatePath } from "next/cache"

import type { OntologyAttribute } from "@/domain/ontology"
import type { OntologyDataTypeId } from "@/features/ontology/utils/data-types"
import { routes } from "@/lib/routes"
import { assertOntologyRecordAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyAttributeSnapshot } from "../linkml/types"

export async function addAttribute(
  classId: string,
  data: {
    name: string
    dataType: OntologyDataTypeId
    required?: boolean
    description?: string
  },
  explicitOntologyId?: string
): Promise<OntologyAttribute> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_classes",
    classId,
    db,
    explicitOntologyId
  )

  const newAttrId = `${classId}.${data.name.trim()}`
  let created: OntologyAttributeSnapshot | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.attributes = draft.attributes ?? []
      const exists = draft.attributes.some(
        (a) =>
          a.class_id === classId &&
          a.name.toLowerCase() === data.name.trim().toLowerCase()
      )
      if (exists) {
        throw new Error(
          `Attribute "${data.name.trim()}" already exists on class "${classId}".`
        )
      }

      created = {
        id: newAttrId,
        class_id: classId,
        name: data.name.trim(),
        data_type: data.dataType,
        required: data.required ?? false,
        description: data.description ?? "",
      }

      draft.attributes.push(created)
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
    class_id: classId,
    name: data.name.trim(),
    data_type: data.dataType,
    required: data.required ?? false,
    description: data.description ?? "",
  }
}

export async function updateAttribute(
  id: string,
  data: {
    name?: string
    dataType?: OntologyDataTypeId
    required?: boolean
    description?: string
  },
  explicitOntologyId?: string
): Promise<OntologyAttribute> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_attributes",
    id,
    db,
    explicitOntologyId
  )

  let targetAttr: OntologyAttributeSnapshot | undefined
  let diffOptions: { attributeRenames?: Record<string, string> } | undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetAttr = draft.attributes?.find((a) => a.id === id || a.name === id)
      if (!targetAttr) {
        throw new Error(`Ontology attribute "${id}" was not found.`)
      }

      const oldKey = targetAttr.id

      if (data.name && data.name.trim() !== targetAttr.name) {
        const newName = data.name.trim()
        const newKey = `${targetAttr.class_id}.${newName}`
        diffOptions = { attributeRenames: { [oldKey]: newKey } }
        targetAttr.name = newName
        targetAttr.id = newKey
      }

      if (data.dataType !== undefined) {
        targetAttr.data_type = data.dataType
      }
      if (data.required !== undefined) {
        targetAttr.required = data.required
      }
      if (data.description !== undefined) {
        targetAttr.description = data.description
      }

      for (const cls of draft.classes) {
        if (cls.attributes) {
          for (const a of cls.attributes) {
            if (a.id === id || a.name === id) {
              if (data.name && data.name.trim() !== "") {
                a.name = data.name.trim()
                a.id = `${a.class_id}.${data.name.trim()}`
              }
              if (data.dataType !== undefined) a.data_type = data.dataType
              if (data.required !== undefined) a.required = data.required
              if (data.description !== undefined)
                a.description = data.description
            }
          }
        }
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
    class_id: targetAttr?.class_id ?? "",
    name: targetAttr?.name ?? data.name ?? "",
    data_type: (targetAttr?.data_type ??
      data.dataType ??
      "xsd:string") as OntologyDataTypeId,
    required: targetAttr?.required ?? data.required ?? false,
    description: targetAttr?.description ?? data.description ?? "",
  }
}

export async function deleteAttribute(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_attributes",
    id,
    db,
    explicitOntologyId
  )

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.attributes = (draft.attributes ?? []).filter(
        (a) => a.id !== id && a.name !== id
      )
      for (const cls of draft.classes) {
        if (cls.attributes) {
          cls.attributes = cls.attributes.filter(
            (a) => a.id !== id && a.name !== id
          )
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
}
