"use server"

import { revalidatePath } from "next/cache"

import type { OntologyModule } from "@/domain/ontology"
import { ModuleTransferSchema } from "@/features/ontology/schemas/module-transfer"
import { routes } from "@/lib/routes"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../../linkml/document-store"
import type { OntologyModuleSnapshot } from "../../linkml/types"
import { getOntologyClasses, getOntologyRelations } from "../../queries"
import { buildCopyModuleName } from "./shared"
import {
  assertModuleNameAvailable,
  createUniqueModuleName,
  getModuleRecord,
} from "./store"
import {
  analyzeModuleTransfer,
  buildModuleTransferPayload,
  persistModuleTransferPayload,
} from "./transfer"
import type {
  BuildModuleExportResult,
  CreateModuleInput,
  DuplicateModuleResult,
  ImportModuleFromJsonInput,
  ImportModuleFromJsonResult,
  ModuleDeleteImpact,
} from "./types"

export type {
  BuildModuleExportResult,
  CreateModuleInput,
  CreateModuleLocalizedTextInput,
  DuplicateModuleResult,
  ImportModuleFromJsonInput,
  ImportModuleFromJsonResult,
  ModuleDeleteImpact,
} from "./types"

export async function createModule({
  ontologyId,
  name,
  description,
  localizedTexts = [],
}: CreateModuleInput): Promise<OntologyModule> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const validatedName = await assertModuleNameAvailable(ontologyId, name)
  const moduleId = validatedName

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.modules = draft.modules ?? []
      const newMod: OntologyModuleSnapshot = {
        id: moduleId,
        name: validatedName,
        description: description ?? "",
      }
      draft.modules.push(newMod)

      if (localizedTexts.length > 0) {
        draft.localized_texts = draft.localized_texts ?? []
        for (const lt of localizedTexts) {
          if (lt.value && lt.value.trim()) {
            draft.localized_texts.push({
              target_type: "module",
              target_id: moduleId,
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
    id: moduleId,
    ontology_id: ontologyId,
    name: validatedName,
    description: description ?? "",
  }
}

export async function updateModule(
  id: string,
  data: string | { name?: string; description?: string },
  explicitOntologyId?: string
): Promise<OntologyModule> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_modules",
    id,
    db,
    explicitOntologyId
  )

  const input = typeof data === "string" ? { name: data } : data
  const newName =
    input.name === undefined
      ? undefined
      : await assertModuleNameAvailable(ontologyId, input.name, id)

  let targetMod: OntologyModuleSnapshot | undefined
  const diffOptions =
    newName && newName !== id ? { moduleRenames: { [id]: newName } } : undefined

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      targetMod = draft.modules?.find((m) => m.id === id || m.name === id)
      if (!targetMod) throw new Error("Module not found.")

      const oldKey = targetMod.id

      if (newName && newName !== oldKey) {
        targetMod.id = newName
        targetMod.name = newName

        // Update classes referencing this module
        if (draft.classes) {
          for (const cls of draft.classes) {
            if (cls.module_id === oldKey) {
              cls.module_id = newName
            }
          }
        }

        // Update UI layout
        if (draft.ui_layout?.moduleLayouts?.[oldKey]) {
          draft.ui_layout.moduleLayouts[newName] =
            draft.ui_layout.moduleLayouts[oldKey]
          delete draft.ui_layout.moduleLayouts[oldKey]
        }
        if (draft.ui_layout?.classPositions?.[oldKey]) {
          draft.ui_layout.classPositions[newName] =
            draft.ui_layout.classPositions[oldKey]
          delete draft.ui_layout.classPositions[oldKey]
        }
      }

      if (input.description !== undefined) {
        targetMod.description = input.description
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
    id: targetMod?.id ?? newName ?? id,
    ontology_id: ontologyId,
    name: targetMod?.name ?? newName ?? id,
    description: targetMod?.description ?? input.description ?? "",
  }
}

export async function renameModule(
  id: string,
  name: string,
  explicitOntologyId?: string
) {
  return updateModule(id, { name }, explicitOntologyId)
}

export async function getModuleDeleteImpact(
  moduleId: string
): Promise<ModuleDeleteImpact> {
  const ontologyModule = await getModuleRecord(moduleId)
  const [classes, relations] = await Promise.all([
    getOntologyClasses(ontologyModule.ontology_id),
    getOntologyRelations(ontologyModule.ontology_id),
  ])
  const classIds = new Set(
    classes.filter((cls) => cls.module_id === moduleId).map((cls) => cls.id)
  )
  return {
    classCount: classIds.size,
    relationCount: relations.filter(
      (relation) =>
        classIds.has(relation.domain_class_id) ||
        classIds.has(relation.range_class_id)
    ).length,
  }
}

export async function deleteModule(
  id: string,
  explicitOntologyId?: string
): Promise<void> {
  const db = getDb()
  const ontologyId = await assertOntologyRecordAccess(
    "ontology_modules",
    id,
    db,
    explicitOntologyId
  )

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.modules = (draft.modules ?? []).filter(
        (m) => m.id !== id && m.name !== id
      )
      // Delete classes belonging to this module
      draft.classes = (draft.classes ?? []).filter((c) => c.module_id !== id)
      if (draft.ui_layout?.moduleLayouts?.[id]) {
        delete draft.ui_layout.moduleLayouts[id]
      }
      if (draft.ui_layout?.classPositions?.[id]) {
        delete draft.ui_layout.classPositions[id]
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

export async function buildModuleExport(
  moduleId: string
): Promise<BuildModuleExportResult> {
  await assertOntologyRecordAccess("ontology_modules", moduleId)
  return buildModuleTransferPayload(moduleId)
}

export async function duplicateModule(
  moduleId: string
): Promise<DuplicateModuleResult> {
  await assertOntologyRecordAccess("ontology_modules", moduleId)
  const ontologyModule = await getModuleRecord(moduleId)
  const exported = await buildModuleTransferPayload(moduleId)
  const duplicated = await persistModuleTransferPayload({
    ontologyId: ontologyModule.ontology_id,
    name: await createUniqueModuleName(
      ontologyModule.ontology_id,
      buildCopyModuleName(ontologyModule.name)
    ),
    description: exported.payload.description,
    payload: exported.payload,
  })
  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
  return {
    module: duplicated.module,
    warnings: [...exported.warnings, ...duplicated.warnings],
  }
}

export async function importModuleFromJson({
  ontologyId,
  file,
  name,
  description,
  localizedTexts = [],
  confirmWarnings = false,
}: ImportModuleFromJsonInput): Promise<ImportModuleFromJsonResult> {
  await assertOntologyDocumentAccess(ontologyId)
  const parsed = ModuleTransferSchema.parse(JSON.parse(await file.text()))
  const finalName = await assertModuleNameAvailable(
    ontologyId,
    name?.trim() || parsed.name
  )
  const analysis = analyzeModuleTransfer(parsed)
  const warnings = [
    ...analysis.missingRelationWarnings,
    ...analysis.missingParentWarnings,
    ...analysis.missingRelationAttributeWarnings,
  ]
  if (!confirmWarnings && analysis.missingRelationWarnings.length) {
    return { status: "needs-confirmation", name: finalName, warnings }
  }
  const result = await persistModuleTransferPayload({
    ontologyId,
    name: finalName,
    description,
    localizedTexts,
    payload: parsed,
  })
  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // Non-Next environment
  }
  return {
    status: "imported",
    module: result.module,
    warnings: result.warnings,
  }
}
