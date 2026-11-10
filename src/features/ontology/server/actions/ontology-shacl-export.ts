"use server"

import {
  buildOntologyExport,
  type BuildOntologyExportInput,
} from "./ontology-transfer"
import { buildShaclShapes } from "../shacl/generator"
import { importOntologyToSnapshot } from "../linkml/ast-mapper"
import { compileSnapshotArtifacts } from "../linkml/compiler"

export type BuildOntologyShaclExportInput = Omit<
  BuildOntologyExportInput,
  "includeVisual"
> & {
  baseIri: string
  closed?: boolean
}

export interface BuildOntologyShaclExportResult {
  content: string
  fileName: string
}

export async function buildOntologyShaclExport({
  baseIri,
  closed = false,
  exportLanguage,
  missingTranslationBehavior,
  classIds,
  moduleIds,
  ontologyId,
  relationIds,
}: BuildOntologyShaclExportInput): Promise<BuildOntologyShaclExportResult> {
  const jsonExport = await buildOntologyExport({
    exportLanguage,
    missingTranslationBehavior,
    ontologyId,
    moduleIds,
    classIds,
    relationIds,
    includeVisual: false,
  })

  let content = ""
  try {
    const snapshot = importOntologyToSnapshot(jsonExport.payload, baseIri)
    const { artifacts } = compileSnapshotArtifacts(snapshot)
    if (artifacts.shacl_ttl && artifacts.shacl_ttl.trim()) {
      content = artifacts.shacl_ttl
    }
  } catch {
    // Fallback to existing builder below
  }

  if (!content) {
    content = buildShaclShapes({
      baseIri,
      ontology: jsonExport.payload,
      closed,
      engine: "legacy",
    })
  }

  return {
    content,
    fileName: jsonExport.fileName.replace(/\.json$/i, ".shacl.ttl"),
  }
}
