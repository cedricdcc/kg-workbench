"use server"

import { revalidatePath } from "next/cache"
import { ImportOntologySchema } from "@/features/ontology/schemas/import"
import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import { parseTurtleToImportOntology } from "../../services/turtle-importer/parse-turtle-to-import-ontology"
import { appendVisualInserts } from "./import-ontology-from-json/append-visual-inserts"
import { persistCompetencyQuestions } from "./import-ontology-from-json/persist-competency-questions"
import { persistImportExamples } from "./import-ontology-from-json/persist-import-examples"
import { persistImportMetadata } from "./import-ontology-from-json/persist-import-metadata"
import { persistOntologyStructure } from "./import-ontology-from-json/persist-ontology-structure"
import type {
  ImportOntologyFromTurtleInput,
  ImportOntologyFromTurtleResult,
} from "./types"

export async function importOntologyFromTurtleInternal(
  input: File | ImportOntologyFromTurtleInput
): Promise<ImportOntologyFromTurtleResult> {
  let content: string
  let fileName = "imported.ttl"

  if (typeof (input as File).text === "function") {
    const file = input as File
    content = await file.text()
    fileName = file.name
  } else {
    const obj = input as ImportOntologyFromTurtleInput
    content = obj.content
    if (obj.fileName) {
      fileName = obj.fileName
    }
  }

  const raw = parseTurtleToImportOntology(content, { fileName })
  const parsed = ImportOntologySchema.parse(raw)
  const warnings: string[] = []
  const db = getDb()

  const ontologyId = await db.transaction(async (tx) => {
    const { ontologyId, idMaps } = await persistOntologyStructure({
      db: tx,
      parsed,
      fileName,
      warnings,
    })

    const pendingCQExampleRefs = await persistCompetencyQuestions({
      db: tx,
      ontologyId,
      parsed,
      idMaps,
      warnings,
    })

    await persistImportMetadata({ db: tx, ontologyId, parsed, idMaps, warnings })
    await persistImportExamples({
      db: tx,
      ontologyId,
      parsed,
      idMaps,
      pendingCQExampleRefs,
      warnings,
    })

    if (parsed.visual) {
      await appendVisualInserts({ db: tx, ontologyId, parsed, warnings, idMaps })
    }

    return ontologyId
  })

  try {
    revalidatePath(routes.ontology.root)
  } catch {
    // revalidatePath is unavailable in node test runner environments
  }

  return { ontologyId, warnings }
}

export async function importOntologyFromTurtle(
  input: File | ImportOntologyFromTurtleInput
): Promise<ImportOntologyFromTurtleResult> {
  return importOntologyFromTurtleInternal(input)
}
