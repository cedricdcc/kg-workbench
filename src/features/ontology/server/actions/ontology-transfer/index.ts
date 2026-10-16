"use server"

import { buildOntologyExportInternal } from "./build-ontology-export"
import { importOntologyFromJsonInternal } from "./import-ontology-from-json"
import {
  importOntologyFromTurtle,
  importOntologyFromTurtleInternal,
} from "./import-ontology-from-turtle"
import type {
  BuildOntologyExportInput,
  BuildOntologyExportResult,
  ImportOntologyFromJsonResult,
  ImportOntologyFromTurtleInput,
  ImportOntologyFromTurtleResult,
} from "./types"

export type {
  BuildOntologyExportInput,
  BuildOntologyExportResult,
  ImportOntologyFromJsonResult,
  ImportOntologyFromTurtleInput,
  ImportOntologyFromTurtleResult,
} from "./types"

export { importOntologyFromTurtleInternal }

export async function buildOntologyExport(
  input: BuildOntologyExportInput
): Promise<BuildOntologyExportResult> {
  return buildOntologyExportInternal(input)
}

export async function importOntologyFromJson(
  file: File
): Promise<ImportOntologyFromJsonResult> {
  return importOntologyFromJsonInternal(file)
}

export { importOntologyFromTurtle }
