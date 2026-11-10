"use server"

import {
  buildOntologyExport,
  type BuildOntologyExportInput,
} from "./ontology-transfer"
import {
  buildOwlOntology,
  convertToLinterEntities,
} from "../owl-export/owl-builder"
import {
  runOntologyLinter,
  type OntologyDefectReport,
} from "@/features/ontology/utils/linter"
import { importOntologyToSnapshot } from "../linkml/ast-mapper"
import { compileSnapshotArtifacts } from "../linkml/compiler"

export type BuildOntologyOwlExportInput = Omit<
  BuildOntologyExportInput,
  "includeVisual"
> & {
  baseIri: string
}

export interface BuildOntologyOwlExportResult {
  content: string
  fileName: string
  defectsReport?: OntologyDefectReport
}

export async function buildOntologyOwlExport({
  baseIri,
  exportLanguage,
  missingTranslationBehavior,
  classIds,
  moduleIds,
  ontologyId,
  relationIds,
}: BuildOntologyOwlExportInput): Promise<BuildOntologyOwlExportResult> {
  const jsonExport = await buildOntologyExport({
    exportLanguage,
    missingTranslationBehavior,
    ontologyId,
    moduleIds,
    classIds,
    relationIds,
    includeVisual: false,
  })

  const { classes, relations } = convertToLinterEntities(jsonExport.payload)
  const defectsReport = runOntologyLinter({ classes, relations })

  let content = ""
  try {
    const snapshot = importOntologyToSnapshot(jsonExport.payload, baseIri)
    const { artifacts } = compileSnapshotArtifacts(snapshot)
    if (artifacts.owl_ttl && artifacts.owl_ttl.trim()) {
      content = artifacts.owl_ttl
    }
  } catch {
    // Fallback to existing builder below
  }

  if (!content) {
    content = buildOwlOntology({
      baseIri,
      ontology: jsonExport.payload,
      defectsReport,
    })
  }

  return {
    content,
    fileName: jsonExport.fileName.replace(/\.json$/i, ".owl"),
    defectsReport,
  }
}
