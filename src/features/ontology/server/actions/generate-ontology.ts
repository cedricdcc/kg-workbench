"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"

import { routes } from "@/lib/routes"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import { getDb } from "@/server/database"
import {
  ontologyAttributes,
  ontologyClasses,
  ontologyCompetencyQuestionModules,
  ontologyCompetencyQuestions,
  ontologyModules,
  ontologyRelations,
} from "@/server/db/schema"
import {
  getOntologyClasses,
  getOntologyCQs,
  getOntologyDocument,
  getOntologyModules,
  getOntologyRelations,
} from "@/features/ontology/server/queries"
import {
  executeAiGeneration,
  listGeminiModels,
  type AiGenerationOptions,
  type GeminiModelInfo,
} from "@/features/ontology/server/services/ai-ontology-generator"
import {
  GeneratedOntologyDraftSchema,
  type GeneratedOntologyDraft,
} from "@/features/ontology/schemas/ai-generation"

export type ApplyDraftResult = {
  createdModules: number
  createdClasses: number
  createdRelations: number
  updatedCQs: number
}

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
    getOntologyDocument(trimmedId),
    getOntologyModules(trimmedId),
    getOntologyClasses(trimmedId),
    getOntologyRelations(trimmedId),
    getOntologyCQs(trimmedId),
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

export async function applyOntologyDraft(
  ontologyId: string,
  rawDraft: GeneratedOntologyDraft
): Promise<ApplyDraftResult> {
  const trimmedId = ontologyId?.trim()
  if (!trimmedId) {
    throw new Error("Ontology ID is required.")
  }

  const draft = GeneratedOntologyDraftSchema.parse(rawDraft)
  const db = getDb()
  await assertOntologyDocumentAccess(trimmedId, db)

  let createdModules = 0
  let createdClasses = 0
  let createdRelations = 0
  let updatedCQs = 0

  await db.transaction(async (tx) => {
    // 1. Process Modules
    const existingModules = await tx
      .select()
      .from(ontologyModules)
      .where(eq(ontologyModules.ontology_id, trimmedId))

    const moduleMap = new Map<string, string>()
    for (const mod of existingModules) {
      moduleMap.set(mod.name.toLowerCase(), mod.id)
    }

    for (const mod of draft.modules) {
      const lower = mod.name.toLowerCase()
      if (!moduleMap.has(lower)) {
        const [inserted] = await tx
          .insert(ontologyModules)
          .values({
            ontology_id: trimmedId,
            name: mod.name,
            description: mod.description || "",
          })
          .returning()
        if (inserted) {
          moduleMap.set(lower, inserted.id)
          createdModules++
        }
      }
    }

    // 2. Process Classes & Attributes
    const existingClasses = await tx
      .select()
      .from(ontologyClasses)
      .where(eq(ontologyClasses.ontology_id, trimmedId))

    const classMap = new Map<string, string>()
    for (const cls of existingClasses) {
      classMap.set(cls.name.toLowerCase(), cls.id)
    }

    for (const cls of draft.classes) {
      const lower = cls.name.toLowerCase()
      const targetModuleId = moduleMap.get(cls.moduleName.toLowerCase()) ?? null

      if (!classMap.has(lower)) {
        const [inserted] = await tx
          .insert(ontologyClasses)
          .values({
            ontology_id: trimmedId,
            module_id: targetModuleId,
            name: cls.name,
            description: cls.description || "",
          })
          .returning()

        if (inserted) {
          classMap.set(lower, inserted.id)
          createdClasses++

          // Insert attributes if any
          if (cls.attributes && cls.attributes.length > 0) {
            await tx.insert(ontologyAttributes).values(
              cls.attributes.map((attr) => ({
                class_id: inserted.id,
                name: attr.name,
                data_type: attr.dataType,
                description: attr.description || "",
              }))
            )
          }
        }
      }
    }

    // 3. Process Relations
    const existingRelations = await tx
      .select()
      .from(ontologyRelations)
      .where(eq(ontologyRelations.ontology_id, trimmedId))

    const relationKeyMap = new Map<string, string>()
    const relationNameMap = new Map<string, string>()

    for (const rel of existingRelations) {
      const key = `${rel.name.toLowerCase()}:${rel.domain_class_id}:${rel.range_class_id}`
      relationKeyMap.set(key, rel.id)
      relationNameMap.set(rel.name.toLowerCase(), rel.id)
    }

    for (const rel of draft.relations) {
      const domainId = classMap.get(rel.domainClassName.toLowerCase())
      const rangeId = classMap.get(rel.rangeClassName.toLowerCase())

      if (domainId && rangeId) {
        const key = `${rel.name.toLowerCase()}:${domainId}:${rangeId}`
        if (!relationKeyMap.has(key)) {
          const [inserted] = await tx
            .insert(ontologyRelations)
            .values({
              ontology_id: trimmedId,
              name: rel.name,
              domain_class_id: domainId,
              range_class_id: rangeId,
              description: rel.description || "",
            })
            .returning()

          if (inserted) {
            relationKeyMap.set(key, inserted.id)
            relationNameMap.set(rel.name.toLowerCase(), inserted.id)
            createdRelations++
          }
        }
      }
    }

    // 4. Update CQ Mappings
    for (const mapping of draft.cqMappings) {
      const subjectClassId =
        classMap.get(mapping.subjectClassName.toLowerCase()) ?? null
      const predicateRelationId =
        relationNameMap.get(mapping.predicateRelationName.toLowerCase()) ?? null
      const objectClassId =
        classMap.get(mapping.objectClassName.toLowerCase()) ?? null

      if (subjectClassId || predicateRelationId || objectClassId) {
        await tx
          .update(ontologyCompetencyQuestions)
          .set({
            subject_class_id: subjectClassId,
            predicate_relation_id: predicateRelationId,
            object_class_id: objectClassId,
          })
          .where(
            and(
              eq(ontologyCompetencyQuestions.id, mapping.cqId),
              eq(ontologyCompetencyQuestions.ontology_id, trimmedId)
            )
          )
        updatedCQs++
      }

      // Link modules
      if (mapping.moduleNames && mapping.moduleNames.length > 0) {
        for (const modName of mapping.moduleNames) {
          const modId = moduleMap.get(modName.toLowerCase())
          if (modId) {
            await tx
              .insert(ontologyCompetencyQuestionModules)
              .values({
                cq_id: mapping.cqId,
                module_id: modId,
              })
              .onConflictDoNothing()
          }
        }
      }
    }
  })

  revalidatePath(routes.ontology.document(trimmedId))
  revalidatePath(routes.ontology.root)

  return {
    createdModules,
    createdClasses,
    createdRelations,
    updatedCQs,
  }
}

export async function getAvailableGeminiModels(
  apiKey?: string
): Promise<GeminiModelInfo[]> {
  return listGeminiModels(apiKey)
}
