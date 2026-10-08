"use server"

import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  getOntologyClasses,
  getOntologyCQs,
  getOntologyDocument,
  getOntologyModules,
  getOntologyRelations,
} from "@/features/ontology/server/queries"
import {
  executeAiGeneration,
  type AiGenerationOptions,
} from "@/features/ontology/server/services/ai-ontology-generator"
import type { GeneratedOntologyDraft } from "@/features/ontology/schemas/ai-generation"

export async function generateOntologyDraft(
  ontologyId: string,
  options: AiGenerationOptions
): Promise<GeneratedOntologyDraft> {
  const trimmedId = ontologyId?.trim()
  if (!trimmedId) {
    throw new Error("Ontology ID is required.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(trimmedId, db)

  const [document, modules, classes, relations, cqs] = await Promise.all([
    getOntologyDocument(trimmedId, db),
    getOntologyModules(trimmedId, db),
    getOntologyClasses(trimmedId, db),
    getOntologyRelations(trimmedId, db),
    getOntologyCQs(trimmedId, db),
  ])

  if (!document) {
    throw new Error("Ontology document not found.")
  }

  const validCQs = cqs.filter((cq) => cq.question && cq.question.trim().length > 0)
  if (validCQs.length === 0) {
    throw new Error(
      "Ontology has no competency questions to analyze. Please add competency questions first."
    )
  }

  const draft = await executeAiGeneration(
    {
      ontologyName: document.name,
      usecase: document.usecase || "",
      existingModules: modules.map((m) => m.name),
      existingClasses: classes.map((c) => c.name),
      existingRelations: relations.map((r) => r.name),
      competencyQuestions: validCQs.map((cq) => ({
        id: cq.id,
        question: cq.question,
      })),
    },
    options
  )

  return draft
}
