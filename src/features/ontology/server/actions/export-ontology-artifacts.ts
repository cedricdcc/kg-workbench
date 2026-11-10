"use server"

import { getOntologyDocument } from "../queries/documents"
import { getOntologyClasses } from "../queries/classes"
import { getOntologyRelations } from "../queries/relations"
import { buildOntologyExport } from "./ontology-transfer"
import { importOntologyToSnapshot } from "../linkml/ast-mapper"
import { compileSnapshotArtifacts } from "../linkml/compiler"
import type { LinkmlLintIssue } from "../linkml/types"

export type OntologyArtifactFormat =
  | "linkml-yaml"
  | "shacl-ttl"
  | "rdfs-ttl"
  | "owl-ttl"
  | "pydantic-py"
  | "json-schema"
  | "er-diagram"

export interface ExportOntologyArtifactsOptions {
  baseIri?: string
  exportLanguage?: string
  moduleIds?: string[]
  classIds?: string[]
  relationIds?: string[]
}

export interface ExportOntologyArtifactResult {
  content: string
  fileName: string
  mimeType: string
  format: OntologyArtifactFormat
  sourceSha256: string
  lintIssues?: LinkmlLintIssue[]
}

export async function exportOntologyArtifactsAction(
  ontologyId: string,
  format: OntologyArtifactFormat,
  options?: ExportOntologyArtifactsOptions
): Promise<ExportOntologyArtifactResult> {
  const [doc, classes, relations] = await Promise.all([
    getOntologyDocument(ontologyId),
    getOntologyClasses(ontologyId),
    getOntologyRelations(ontologyId),
  ])

  const effectiveModuleIds = options?.moduleIds ?? doc.modules.map((m) => m.id)
  const effectiveClassIds = options?.classIds ?? classes.map((c) => c.id)
  const effectiveRelationIds =
    options?.relationIds ?? relations.map((r) => r.id)

  const jsonExport = await buildOntologyExport({
    ontologyId,
    exportLanguage: options?.exportLanguage ?? doc.default_language ?? "en",
    missingTranslationBehavior: "fallback",
    moduleIds: effectiveModuleIds,
    classIds: effectiveClassIds,
    relationIds: effectiveRelationIds,
    includeVisual: true,
  })

  const snapshot = importOntologyToSnapshot(
    jsonExport.payload,
    options?.baseIri
  )
  const { linkmlYaml, artifacts } = compileSnapshotArtifacts(snapshot)

  const baseFileName = jsonExport.fileName.replace(/\.json$/i, "")

  switch (format) {
    case "linkml-yaml":
      return {
        content: linkmlYaml,
        fileName: `${baseFileName}.linkml.yaml`,
        mimeType: "application/yaml",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "shacl-ttl":
      return {
        content: artifacts.shacl_ttl,
        fileName: `${baseFileName}.shacl.ttl`,
        mimeType: "text/turtle",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "rdfs-ttl":
      return {
        content: artifacts.rdfs_ttl,
        fileName: `${baseFileName}.rdfs.ttl`,
        mimeType: "text/turtle",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "owl-ttl":
      return {
        content: artifacts.owl_ttl,
        fileName: `${baseFileName}.owl.ttl`,
        mimeType: "text/turtle",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "pydantic-py":
      return {
        content: artifacts.pydantic_py,
        fileName: `${baseFileName}.pydantic.py`,
        mimeType: "text/x-python",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "json-schema":
      return {
        content: artifacts.json_schema,
        fileName: `${baseFileName}.schema.json`,
        mimeType: "application/json",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    case "er-diagram":
      return {
        content: artifacts.er_diagram,
        fileName: `${baseFileName}.mermaid.mmd`,
        mimeType: "text/plain",
        format,
        sourceSha256: artifacts.source_sha256,
        lintIssues: artifacts.lint_issues,
      }
    default: {
      const exhaustiveCheck: never = format
      throw new Error(`Unsupported export format: ${String(exhaustiveCheck)}`)
    }
  }
}
