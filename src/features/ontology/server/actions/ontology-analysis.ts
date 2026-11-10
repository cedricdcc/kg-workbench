"use server"

import { getDb } from "@/server/database"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getOntologyClasses } from "@/features/ontology/server/queries/classes"
import { getActiveReferenceTerms } from "@/features/ontology/server/queries/reference-vocabularies"
import {
  calculateOntologyAnalysis,
  type OntologyAnalysisResult,
} from "@/features/ontology/server/services/ontology-analysis/analyze-ontology"

export async function runFullOntologyAnalysis(
  ontologyId: string
): Promise<OntologyAnalysisResult> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const ontologyClassesList = await getOntologyClasses(ontologyId)
  const classes = ontologyClassesList.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    parent_class_id: c.parent_class_id,
  }))

  const activeTerms = await getActiveReferenceTerms()

  return calculateOntologyAnalysis({
    classes,
    installedTerms: activeTerms.map((t) => ({
      curie: t.curie,
      label: t.label,
      type: t.type,
      description: t.description,
      iri: t.iri,
    })),
  })
}
