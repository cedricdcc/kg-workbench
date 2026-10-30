"use server"

import {
  buildOntologyExport,
  type BuildOntologyExportInput,
} from "./ontology-transfer"
import { buildShaclShapes } from "../shacl/generator"

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

  return {
    content: buildShaclShapes({
      baseIri,
      ontology: jsonExport.payload,
      closed,
    }),
    fileName: jsonExport.fileName.replace(/\.json$/i, ".shacl.ttl"),
  }
}
