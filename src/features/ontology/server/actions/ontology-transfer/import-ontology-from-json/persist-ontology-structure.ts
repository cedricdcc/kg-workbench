import type { ImportOntology } from "@/features/ontology/schemas/import"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { ontologyDocuments } from "@/server/db/schema"
import { importOntologyToSnapshot } from "@/features/ontology/server/linkml/ast-mapper"
import { compileSnapshotArtifacts } from "@/features/ontology/server/linkml/compiler"
import { collectImportModules } from "../helpers"
import type {
  ImportIdMaps,
  PersistOntologyStructureResult,
  ServerClient,
} from "./shared-types"

function createIdMaps(): ImportIdMaps {
  return {
    moduleIdByLegacyId: new Map(),
    moduleIdByName: new Map(),
    oldAttributeIdToNewId: new Map(),
    oldClassIdToNewId: new Map(),
    oldClassIdToNewModuleId: new Map(),
    oldCQIdToNewId: new Map(),
    oldRelationAttributeIdToNewId: new Map(),
    oldRelationIdToNewId: new Map(),
  }
}

export async function persistOntologyStructure({
  db,
  parsed,
  fileName,
}: {
  db: ServerClient
  parsed: ImportOntology
  fileName: string
  warnings: string[]
}): Promise<PersistOntologyStructureResult> {
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const snapshot = importOntologyToSnapshot(parsed)
  snapshot.document.group_key = groupKey
  if (fileName) {
    snapshot.document.id = fileName.replace(/\.[^/.]+$/, "")
  }

  const compiled = compileSnapshotArtifacts(snapshot)

  const [document] = await db
    .insert(ontologyDocuments)
    .values({
      default_language: parsed.defaultLanguage || "en",
      group_key: groupKey,
      name: parsed.name,
      version: parsed.version ?? "1.0.0",
      source_file: fileName || null,
      usecase: parsed.usecase ?? "",
      linkml_yaml: compiled.linkmlYaml,
      ui_layout: snapshot.ui_layout ?? {
        classPositions: {},
        moduleLayouts: {},
      },
      compiled_artifacts: compiled.artifacts,
    })
    .returning()

  if (!document) throw new Error("Could not create ontology document.")

  const ontologyId = document.id
  const idMaps = createIdMaps()

  const importedModules = collectImportModules(parsed)
  for (const mod of importedModules) {
    idMaps.moduleIdByName.set(mod.name, mod.name)
    idMaps.moduleIdByLegacyId.set(mod.id, mod.name)
  }

  for (const source of parsed.classes) {
    idMaps.oldClassIdToNewId.set(source.id, source.name)
    idMaps.oldClassIdToNewId.set(source.name, source.name)
    idMaps.oldClassIdToNewModuleId.set(source.id, source.module || null)

    for (const attr of source.attributes) {
      const attrKey = `${source.name}.${attr.name}`
      if (attr.id) idMaps.oldAttributeIdToNewId.set(attr.id, attrKey)
      idMaps.oldAttributeIdToNewId.set(attrKey, attrKey)
    }
  }

  for (const source of parsed.relations) {
    if (source.id) idMaps.oldRelationIdToNewId.set(source.id, source.name)
    idMaps.oldRelationIdToNewId.set(source.name, source.name)
  }

  for (const ra of parsed.relationAttributes ?? []) {
    const relName =
      idMaps.oldRelationIdToNewId.get(ra.relationId) || ra.relationId
    const raKey = `${relName}.${ra.name}`
    if (ra.id) idMaps.oldRelationAttributeIdToNewId.set(ra.id, raKey)
    idMaps.oldRelationAttributeIdToNewId.set(raKey, raKey)
  }

  return { ontologyId, idMaps }
}
