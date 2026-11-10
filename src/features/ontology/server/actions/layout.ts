"use server"

import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import { saveCanonicalOntology } from "../linkml/document-store"

export async function saveModuleLayout(
  ontologyId: string,
  moduleId: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.ui_layout = draft.ui_layout ?? {
        classPositions: {},
        moduleLayouts: {},
      }
      draft.ui_layout.moduleLayouts = draft.ui_layout.moduleLayouts ?? {}
      draft.ui_layout.moduleLayouts[moduleId] = { x, y, width, height }
    },
    { db, recompile: false }
  )
}

export async function saveClassPosition(
  ontologyId: string,
  classId: string,
  moduleId: string,
  x: number,
  y: number
): Promise<void> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.ui_layout = draft.ui_layout ?? {
        classPositions: {},
        moduleLayouts: {},
      }
      draft.ui_layout.classPositions = draft.ui_layout.classPositions ?? {}
      draft.ui_layout.classPositions[moduleId] =
        draft.ui_layout.classPositions[moduleId] ?? {}
      draft.ui_layout.classPositions[moduleId][classId] = { x, y }
    },
    { db, recompile: false }
  )
}

export async function saveModuleLayoutsAction(
  ontologyId: string,
  layouts: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >
): Promise<void> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.ui_layout = draft.ui_layout ?? {
        classPositions: {},
        moduleLayouts: {},
      }
      draft.ui_layout.moduleLayouts = {
        ...(draft.ui_layout.moduleLayouts ?? {}),
        ...layouts,
      }
    },
    { db, recompile: false }
  )
}

export async function saveClassPositionsAction(
  ontologyId: string,
  positions: Record<string, Record<string, { x: number; y: number }>>
): Promise<void> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  await saveCanonicalOntology(
    ontologyId,
    (draft) => {
      draft.ui_layout = draft.ui_layout ?? {
        classPositions: {},
        moduleLayouts: {},
      }
      draft.ui_layout.classPositions = {
        ...(draft.ui_layout.classPositions ?? {}),
        ...positions,
      }
    },
    { db, recompile: false }
  )
}
