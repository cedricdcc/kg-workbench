"use server"

import { revalidatePath } from "next/cache"

import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { validateHierarchyAcyclicity } from "@/features/ontology/utils/hierarchy-validation"
import type {
  MergeClassesInput,
  ReparentClassInput,
} from "@/features/ontology/schemas/class-refactoring"
import {
  MergeClassesInputSchema,
  ReparentClassInputSchema,
} from "@/features/ontology/schemas/class-refactoring"
import { saveCanonicalOntology } from "../linkml/document-store"

export async function refactorClassHierarchy(
  input: ReparentClassInput
): Promise<{ classId: string }> {
  const validated = ReparentClassInputSchema.parse(input)
  const db = getDb()

  await assertOntologyDocumentAccess(validated.ontologyId, db)

  if (
    validated.targetParentClassId &&
    validated.targetParentClassId === validated.classId
  ) {
    throw new Error("A class cannot be its own parent.")
  }

  await saveCanonicalOntology(
    validated.ontologyId,
    (draft) => {
      const cls = draft.classes.find(
        (c) => c.id === validated.classId || c.name === validated.classId
      )
      if (!cls) {
        throw new Error(`Class "${validated.classId}" was not found.`)
      }

      // Check hierarchy cycle
      if (validated.targetParentClassId) {
        const hierarchyList = draft.classes.map((c) => ({
          id: c.id,
          parent_class_id: c.parent_class_id ?? null,
        }))

        const cycleCheck = validateHierarchyAcyclicity(
          cls.id,
          validated.targetParentClassId,
          hierarchyList
        )

        if (!cycleCheck.valid) {
          throw new Error(
            `Hierarchy cycle detected: ${cycleCheck.cyclePath?.join(" → ")}`
          )
        }
      }

      // 1. Update parent class
      cls.parent_class_id = validated.targetParentClassId ?? null

      // 2. Drop redundant attributes if requested
      if (validated.dropAttributeIds && validated.dropAttributeIds.length > 0) {
        const dropSet = new Set(validated.dropAttributeIds)
        draft.attributes = (draft.attributes ?? []).filter((attr) => {
          if (attr.class_id !== cls.id && attr.class_id !== cls.name) {
            return true
          }
          return !dropSet.has(attr.id) && !dropSet.has(attr.name)
        })
      }
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root, "layout")
  } catch {
    // Non-Next environment
  }

  return { classId: validated.classId }
}

export async function mergeClasses(input: MergeClassesInput): Promise<{
  targetClassId: string
  migratedRelations: number
  migratedFacts: number
}> {
  const validated = MergeClassesInputSchema.parse(input)
  if (validated.sourceClassId === validated.targetClassId) {
    throw new Error("Cannot merge a class into itself.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(validated.ontologyId, db)

  let migratedRelations = 0

  await saveCanonicalOntology(
    validated.ontologyId,
    (draft) => {
      const sourceClass = draft.classes.find(
        (c) =>
          c.id === validated.sourceClassId || c.name === validated.sourceClassId
      )
      const targetClass = draft.classes.find(
        (c) =>
          c.id === validated.targetClassId || c.name === validated.targetClassId
      )

      if (!sourceClass) {
        throw new Error(
          `Source class "${validated.sourceClassId}" was not found.`
        )
      }
      if (!targetClass) {
        throw new Error(
          `Target class "${validated.targetClassId}" was not found.`
        )
      }

      const sourceKey = sourceClass.id
      const targetKey = targetClass.id

      // 1. Migrate relations where sourceClass is domain or range
      for (const rel of draft.relations ?? []) {
        let changed = false
        if (rel.domain_class_id === sourceKey) {
          rel.domain_class_id = targetKey
          changed = true
        }
        if (rel.range_class_id === sourceKey) {
          rel.range_class_id = targetKey
          changed = true
        }
        if (changed) migratedRelations++
      }

      // 2. Move retained attributes to target class
      const retainedSet = new Set(validated.retainedAttributeIds ?? [])
      const updatedAttributes = []

      for (const attr of draft.attributes ?? []) {
        if (attr.class_id === sourceKey) {
          const isRetained =
            retainedSet.has(attr.id) ||
            retainedSet.has(attr.name) ||
            retainedSet.has(`${sourceKey}.${attr.name}`)

          if (isRetained) {
            // Check if target already has an attribute with this name
            const alreadyOnTarget = (draft.attributes ?? []).some(
              (a) =>
                a.class_id === targetKey &&
                a.name.toLowerCase() === attr.name.toLowerCase()
            )
            if (!alreadyOnTarget) {
              attr.class_id = targetKey
              attr.id = `${targetKey}.${attr.name}`
              updatedAttributes.push(attr)
            }
          }
        } else {
          updatedAttributes.push(attr)
        }
      }
      draft.attributes = updatedAttributes

      // 3. Update any child classes of source to now point to target
      for (const cls of draft.classes) {
        if (cls.parent_class_id === sourceKey) {
          cls.parent_class_id = targetKey
        }
      }

      // 4. Delete source class from draft
      draft.classes = draft.classes.filter((c) => c.id !== sourceKey)

      // 5. Clean layout
      if (draft.ui_layout?.classPositions) {
        for (const modId of Object.keys(draft.ui_layout.classPositions)) {
          if (draft.ui_layout.classPositions[modId]) {
            delete draft.ui_layout.classPositions[modId][sourceKey]
          }
        }
      }
    },
    { db }
  )

  try {
    revalidatePath(routes.ontology.root, "layout")
  } catch {
    // Non-Next environment
  }

  return {
    targetClassId: validated.targetClassId,
    migratedRelations,
    migratedFacts: 0,
  }
}
