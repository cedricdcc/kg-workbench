"use server"

import { revalidatePath } from "next/cache"

import type { OntologyClass } from "@/domain/ontology"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"
import type { OntologyClassSnapshot } from "../linkml/types"
import {
  ReconcileAndAdoptClassInputSchema,
  type ReconcileAndAdoptClassInput,
} from "../../schemas/reconciliation"

export async function createClass(
  ontologyId: string,
  moduleId: string,
  data: {
    name: string
    description?: string
    parentClassId?: string | null
    localizedTexts?: Array<{
      fieldName: string
      languageCode: string
      value: string
    }>
  }
): Promise<OntologyClass> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const newClassId = data.name.trim()

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      // Check for duplicate class
      const exists = draft.classes.some(
        (c) => c.name.toLowerCase() === newClassId.toLowerCase()
      )
      if (exists) {
        throw new Error(`Class "${newClassId}" already exists.`)
      }

      const newCls: OntologyClassSnapshot = {
        id: newClassId,
        name: newClassId,
        description: data.description ?? "",
        module_id: moduleId || null,
        parent_class_id: data.parentClassId ?? null,
        instance_policy: "open",
        attributes: [],
      }

      draft.classes.push(newCls)

      if (data.localizedTexts && data.localizedTexts.length > 0) {
        draft.localized_texts = draft.localized_texts ?? []
        for (const lt of data.localizedTexts) {
          if (lt.value && lt.value.trim()) {
            draft.localized_texts.push({
              target_type: "class",
              target_id: newClassId,
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
    id: newClassId,
    ontology_id: ontologyId,
    module_id: moduleId || null,
    name: newClassId,
    description: data.description ?? "",
    parent_class_id: data.parentClassId ?? null,
    instance_policy: "open",
  }
}

export async function updateClass(
  id: string,
  data: {
    name?: string
    description?: string
    moduleId?: string | null
    parentClassId?: string | null
    instancePolicy?: string
  },
  explicitOntologyId?: string
): Promise<OntologyClass> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_classes", id, db))

  let targetClass: OntologyClassSnapshot | undefined
  const newName = data.name?.trim()

  const diffOptions =
    newName && newName !== id ? { classRenames: { [id]: newName } } : undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetClass = draft.classes.find((c) => c.id === id || c.name === id)
      if (!targetClass) {
        throw new Error(`Ontology class "${id}" was not found.`)
      }

      const oldKey = targetClass.id

      if (newName && newName !== oldKey) {
        targetClass.id = newName
        targetClass.name = newName

        // Update attributes belonging to this class
        if (draft.attributes) {
          for (const attr of draft.attributes) {
            if (attr.class_id === oldKey) {
              attr.class_id = newName
              attr.id = `${newName}.${attr.name}`
            }
          }
        }

        // Update relations referencing this class
        if (draft.relations) {
          for (const rel of draft.relations) {
            if (rel.domain_class_id === oldKey) rel.domain_class_id = newName
            if (rel.range_class_id === oldKey) rel.range_class_id = newName
          }
        }

        // Update child classes
        for (const cls of draft.classes) {
          if (cls.parent_class_id === oldKey) cls.parent_class_id = newName
        }

        // Update UI layout
        if (draft.ui_layout?.classPositions) {
          for (const modId of Object.keys(draft.ui_layout.classPositions)) {
            const modPositions = draft.ui_layout.classPositions[modId]
            if (modPositions && modPositions[oldKey]) {
              modPositions[newName] = modPositions[oldKey]
              delete modPositions[oldKey]
            }
          }
        }
      }

      if (data.description !== undefined) {
        targetClass.description = data.description
      }
      if (data.moduleId !== undefined) {
        targetClass.module_id = data.moduleId
      }
      if (data.parentClassId !== undefined) {
        targetClass.parent_class_id = data.parentClassId
      }
      if (data.instancePolicy !== undefined) {
        targetClass.instance_policy = data.instancePolicy
      }
    },
    { db, diffOptions }
  )

  try {
    revalidatePath(routes.ontology.root, "layout")
  } catch {
    // Non-Next environment
  }

  return {
    id: targetClass?.id ?? newName ?? id,
    ontology_id: ontologyId,
    module_id: targetClass?.module_id ?? data.moduleId ?? null,
    name: targetClass?.name ?? newName ?? id,
    description: targetClass?.description ?? data.description ?? "",
    parent_class_id: targetClass?.parent_class_id ?? data.parentClassId ?? null,
    instance_policy:
      targetClass?.instance_policy ?? data.instancePolicy ?? "open",
  }
}

export async function deleteClass(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_classes", id, db))

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.classes = draft.classes.filter((c) => c.id !== id && c.name !== id)
      draft.attributes = (draft.attributes ?? []).filter(
        (a) => a.class_id !== id
      )
      draft.relations = (draft.relations ?? []).filter(
        (r) => r.domain_class_id !== id && r.range_class_id !== id
      )
      for (const c of draft.classes) {
        if (c.parent_class_id === id) {
          c.parent_class_id = null
        }
      }
      if (draft.ui_layout?.classPositions) {
        for (const modId of Object.keys(draft.ui_layout.classPositions)) {
          if (draft.ui_layout.classPositions[modId]) {
            delete draft.ui_layout.classPositions[modId][id]
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
}

export async function reconcileAndAdoptClass(
  rawInput: ReconcileAndAdoptClassInput
): Promise<{
  classId: string
  updatedRelations: number
  deletedRelations: number
}> {
  const input = ReconcileAndAdoptClassInputSchema.parse(rawInput)
  const db = getDb()
  await assertOntologyDocumentAccess(input.ontologyId, db)

  let updatedRelations = 0
  let deletedRelations = 0

  await saveCanonicalOntology(
    input.ontologyId,
    (draft) => {
      const cls = draft.classes.find(
        (c) => c.id === input.classId || c.name === input.classId
      )
      if (!cls) {
        throw new Error(
          `Class "${input.classId}" not found for reconciliation.`
        )
      }

      // 1. Update class identity in-place
      cls.description = input.standardTerm.description ?? cls.description

      // 2. Prune unselected attributes
      const retainedSet = new Set(input.retainedAttributeIds)
      draft.attributes = (draft.attributes ?? []).filter((attr) => {
        if (attr.class_id !== cls.id && attr.class_id !== cls.name) {
          return true
        }
        return (
          retainedSet.has(attr.id) ||
          retainedSet.has(attr.name) ||
          retainedSet.has(`${cls.name}.${attr.name}`)
        )
      })

      // 3. Process relation decisions
      for (const decision of input.relationDecisions) {
        const relIdx = (draft.relations ?? []).findIndex(
          (r) => r.id === decision.relationId || r.name === decision.relationId
        )
        if (relIdx !== -1) {
          if (decision.action === "delete") {
            draft.relations.splice(relIdx, 1)
            deletedRelations++
          } else if (decision.action === "remap" && decision.remappedName) {
            draft.relations[relIdx].id = decision.remappedName
            draft.relations[relIdx].name = decision.remappedName
            if (decision.remappedDescription !== undefined) {
              draft.relations[relIdx].description = decision.remappedDescription
            }
            updatedRelations++
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
    classId: input.classId,
    updatedRelations,
    deletedRelations,
  }
}

export async function suggestRelationRemappingsAction(input: {
  ontologyId: string
  oldClassName: string
  standardTermCurie: string
  standardTermDescription?: string
  relations: import("../services/ai-relation-reconciliation").ConnectedRelationContext[]
  apiKey?: string
  model?: string
  candidateModels?: string[]
}): Promise<import("../services/ai-relation-reconciliation").SuggestionResult> {
  const db = getDb()
  await assertOntologyDocumentAccess(input.ontologyId, db)
  const { suggestRelationRemappings } =
    await import("../services/ai-relation-reconciliation")
  return suggestRelationRemappings(input)
}
