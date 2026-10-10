"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { ontologyClasses } from "@/server/db/schema"
import { assertOntologyDocumentAccess } from "@/server/group-access"
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

  const classes = await db
    .select({
      id: ontologyClasses.id,
      name: ontologyClasses.name,
      description: ontologyClasses.description,
      parent_class_id: ontologyClasses.parent_class_id,
    })
    .from(ontologyClasses)
    .where(eq(ontologyClasses.ontology_id, ontologyId))

  const activeTerms = await getActiveReferenceTerms()

  return calculateOntologyAnalysis({
    classes,
    installedTerms: activeTerms.map((t) => ({
      curie: t.curie,
      label: t.label,
      type: t.type,
      description: t.description,
    })),
  })
}
