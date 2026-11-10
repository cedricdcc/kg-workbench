import type { ImportOntology } from "@/features/ontology/schemas/import"

export interface BuildShaclShapesInput {
  baseIri: string
  ontology: ImportOntology
  closed?: boolean
  preferLinkml?: boolean
  engine?: "linkml" | "legacy" | "auto"
}

export type ShaclSeverity = "Info" | "Warning" | "Violation"

export interface ShaclValidationResult {
  focusNode: string
  resultPath: string
  value?: unknown
  resultSeverity: ShaclSeverity
  resultMessage: string
  sourceShape?: string
}

export interface ShaclValidationReport {
  conforms: boolean
  results: ShaclValidationResult[]
  targetShapesCount: number
}

export interface CandidateTriple {
  subjectText: string
  subjectClass?: string
  relationText: string
  objectText: string
  objectClass?: string
  attributes?: Record<string, unknown>
}

export interface ValidateTriplesInput {
  triples: CandidateTriple[]
  ontology: ImportOntology
}
