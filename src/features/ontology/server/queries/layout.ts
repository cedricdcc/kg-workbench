"use server"

import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  loadCanonicalOntology,
  type AnyDbClient,
} from "../linkml/document-store"
import type { ClassPositionsByModule, ModuleLayoutMap } from "./types"

export async function getClassPositions(
  ontologyId: string,
  db?: AnyDbClient
): Promise<ClassPositionsByModule> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return snapshot.ui_layout?.classPositions ?? {}
}

export async function getModuleLayouts(
  ontologyId: string,
  db?: AnyDbClient
): Promise<ModuleLayoutMap> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return snapshot.ui_layout?.moduleLayouts ?? {}
}

export async function getOntologyLayout(
  ontologyId: string,
  db?: AnyDbClient
): Promise<{
  classPositions: ClassPositionsByModule
  moduleLayouts: ModuleLayoutMap
}> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertOntologyDocumentAccess(ontologyId, database)
  const snapshot = await loadCanonicalOntology(ontologyId, database)

  return {
    classPositions: snapshot.ui_layout?.classPositions ?? {},
    moduleLayouts: snapshot.ui_layout?.moduleLayouts ?? {},
  }
}
