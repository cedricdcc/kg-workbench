import type { OntologyModule } from "@/domain/ontology"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { getDb } from "@/server/database"
import { loadCanonicalOntology } from "../../linkml/document-store"
import { normalizeComparableName } from "./shared"

async function getOntologyModuleRows(ontologyId: string) {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  const snapshot = await loadCanonicalOntology(ontologyId, db)
  return (snapshot.modules ?? []).map((module) => ({
    id: module.id,
    name: module.name,
  }))
}

export async function assertModuleNameAvailable(
  ontologyId: string,
  name: string,
  excludeId?: string
): Promise<string> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error("Module name is required.")
  const modules = await getOntologyModuleRows(ontologyId)
  const normalized = normalizeComparableName(trimmedName)
  if (
    modules.some(
      (module) =>
        module.id !== excludeId &&
        normalizeComparableName(module.name) === normalized
    )
  )
    throw new Error(`Module "${trimmedName}" already exists.`)
  return trimmedName
}

export async function createUniqueModuleName(
  ontologyId: string,
  baseName: string
): Promise<string> {
  const trimmedBaseName = baseName.trim()
  const existingNames = new Set(
    (await getOntologyModuleRows(ontologyId)).map((module) =>
      normalizeComparableName(module.name)
    )
  )
  let candidate = trimmedBaseName
  let suffix = 2
  while (existingNames.has(normalizeComparableName(candidate)))
    candidate = `${trimmedBaseName} ${suffix++}`
  return candidate
}

export async function getModuleRecord(
  moduleId: string,
  explicitOntologyId?: string
): Promise<OntologyModule> {
  const db = getDb()
  const ontologyId =
    explicitOntologyId ??
    (await assertOntologyRecordAccess("ontology_modules", moduleId, db))
  const snapshot = await loadCanonicalOntology(ontologyId, db)
  const mod = snapshot.modules?.find(
    (m) => m.id === moduleId || m.name === moduleId
  )
  if (!mod) throw new Error("Module not found.")
  return {
    id: mod.id,
    ontology_id: ontologyId,
    name: mod.name,
    description: mod.description ?? "",
  }
}
