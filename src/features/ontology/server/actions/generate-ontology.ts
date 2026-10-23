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
  ontologyCqTriples,
  ontologyModules,
  ontologyRelations,
} from "@/server/db/schema"
import {
  addReferenceOntology,
  syncReferenceOntology,
} from "@/features/ontology/server/actions/reference-vocabularies"
import {
  discoverCandidateRegistries,
  type DiscoveredVocabularyItem,
} from "@/features/ontology/server/services/vocabulary-registries/domain-discovery"
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
  autoHealOntologyDraft,
  type AiGenerationOptions,
  type GeminiModelInfo,
} from "@/features/ontology/server/services/ai-ontology-generator"
import {
  GeneratedOntologyDraftSchema,
  type GeneratedOntologyDraft,
  type GeneratedOntologyDraftInput,
} from "@/features/ontology/schemas/ai-generation"
import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"
import { getActiveReferenceTerms } from "@/features/ontology/server/queries/reference-vocabularies"
import { getLocalEmbedding } from "@/server/embedding/local-embedder"
import { rankTermsBySimilarity } from "@/features/ontology/server/services/vector-similarity"
import { expandContextualConnections } from "@/features/ontology/server/services/ai-ontology-generator/contextual-expansion"

export type ApplyDraftResult = {
  createdModules: number
  createdClasses: number
  createdRelations: number
  updatedCQs: number
}

export async function getRegistryDiscoveryCandidates(
  ontologyId: string
): Promise<{
  activeVocabularies: DiscoveredVocabularyItem[]
  recommendedVocabularies: DiscoveredVocabularyItem[]
}> {
  const trimmedId = ontologyId?.trim()
  if (!trimmedId) {
    throw new Error("Ontology ID is required.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(trimmedId, db)

  const [document, cqs] = await Promise.all([
    getOntologyDocument(trimmedId),
    getOntologyCQs(trimmedId),
  ])

  if (!document) {
    throw new Error("Ontology document not found.")
  }

  const validCQs = cqs.filter(
    (cq) => cq.question && cq.question.trim().length > 0
  )
  return discoverCandidateRegistries(
    trimmedId,
    document.usecase || "",
    validCQs
  )
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

  // 0. Import any user-confirmed candidate vocabularies first
  if (options.vocabulariesToImport && options.vocabulariesToImport.length > 0) {
    for (const v of options.vocabulariesToImport) {
      try {
        const added = await addReferenceOntology(v)
        if (added?.id) {
          await syncReferenceOntology(added.id)
        }
      } catch (err) {
        console.warn(
          `[generateOntologyDraft] Failed to auto-import vocabulary "${v.prefix}":`,
          err
        )
      }
    }
  }

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

  const validCQs = cqs.filter(
    (cq) => cq.question && cq.question.trim().length > 0
  )
  if (validCQs.length === 0) {
    throw new Error(
      "Ontology has no competency questions to analyze. Please add competency questions first."
    )
  }

  // 1. Retrieve active reference terms and pre-filter candidates via local vector embeddings
  let candidateReferenceTerms: Array<{
    curie: string
    label: string
    description: string
    iri: string
    type: string
  }> = []

  const activeReferenceTerms = await getActiveReferenceTerms().catch(() => [])

  if (activeReferenceTerms.length > 0) {
    const candidateMap = new Map<string, (typeof activeReferenceTerms)[0]>()
    for (const cq of validCQs) {
      const cqEmbedding = await getLocalEmbedding(cq.question)
      const matches = rankTermsBySimilarity(cqEmbedding, activeReferenceTerms, {
        minSimilarity: 0.1,
        topK: 3,
      })
      for (const match of matches) {
        candidateMap.set(match.curie.toLowerCase(), match)
      }
    }
    candidateReferenceTerms = Array.from(candidateMap.values()).map((t) => ({
      curie: t.curie,
      label: t.label,
      description: t.description,
      iri: t.iri,
      type: t.type,
    }))
  }

  // 2. Generate initial draft from LLM
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
      candidateReferenceTerms,
    },
    options
  )

  // 3. Contextual Graph Expansion (Option B): Resolve parent classes and related properties
  if (activeReferenceTerms.length > 0) {
    const adoptedCuries: string[] = []
    for (const cls of draft.classes) {
      if (cls.alignment?.targetCurie) {
        adoptedCuries.push(cls.alignment.targetCurie)
      }
    }
    for (const rel of draft.relations) {
      if (rel.alignment?.targetCurie) {
        adoptedCuries.push(rel.alignment.targetCurie)
      }
    }

    if (adoptedCuries.length > 0) {
      const expansion = expandContextualConnections(
        adoptedCuries,
        activeReferenceTerms
      )
      draft.suggestedContext = [
        ...expansion.suggestedParents.map((p) => ({
          curie: p.curie,
          iri: p.iri,
          label: p.label,
          type: "parentClass" as const,
        })),
        ...expansion.suggestedProperties.map((p) => ({
          curie: p.curie,
          iri: p.iri,
          label: p.label,
          type: "relatedProperty" as const,
        })),
      ]
    }
  }

  const { draft: healedDraft, healedIssues } = autoHealOntologyDraft(
    draft,
    classes
  )
  if (healedIssues.length > 0) {
    console.info(
      `[generateOntologyDraft] Auto-healed ${healedIssues.length} issues:`,
      healedIssues
    )
  }

  return healedDraft
}

export async function applyOntologyDraft(
  ontologyId: string,
  rawDraft: GeneratedOntologyDraft | GeneratedOntologyDraftInput
): Promise<ApplyDraftResult> {
  const trimmedId = ontologyId?.trim()
  if (!trimmedId) {
    throw new Error("Ontology ID is required.")
  }

  const parsedDraft = GeneratedOntologyDraftSchema.parse(rawDraft)
  const db = getDb()
  await assertOntologyDocumentAccess(trimmedId, db)

  const existingClassesBefore = await db
    .select({ id: ontologyClasses.id, name: ontologyClasses.name })
    .from(ontologyClasses)
    .where(eq(ontologyClasses.ontology_id, trimmedId))

  const { draft, healedIssues } = autoHealOntologyDraft(
    parsedDraft,
    existingClassesBefore
  )
  if (healedIssues.length > 0) {
    console.info(
      `[applyOntologyDraft] Auto-healed ${healedIssues.length} issues:`,
      healedIssues
    )
  }

  let createdModules = 0
  let createdClasses = 0
  let createdRelations = 0
  let updatedCQs = 0

  try {
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
        const targetModuleId =
          moduleMap.get(cls.moduleName.toLowerCase()) ?? null

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
                  data_type: normalizeOntologyDataTypeOrDefault(attr.dataType),
                  description: attr.description || "",
                }))
              )
            }
          }
        }
      }

      // Option B Contextual Graph Closure: Incorporate selected suggestedContext parent classes
      if (draft.suggestedContext && draft.suggestedContext.length > 0) {
        for (const ctx of draft.suggestedContext) {
          if (ctx.type === "parentClass") {
            const name = ctx.label || ctx.curie
            const lower = name.toLowerCase()
            const curieLower = ctx.curie.toLowerCase()
            if (!classMap.has(lower) && !classMap.has(curieLower)) {
              const [inserted] = await tx
                .insert(ontologyClasses)
                .values({
                  ontology_id: trimmedId,
                  module_id: null,
                  name,
                  description: `Standard parent class (${ctx.curie})`,
                })
                .returning()

              if (inserted) {
                classMap.set(lower, inserted.id)
                classMap.set(curieLower, inserted.id)
                createdClasses++
              }
            }
          }
        }
      }

      // Wire parent class relationships if parentClassName was provided
      for (const cls of draft.classes) {
        if (cls.parentClassName) {
          const parentId = classMap.get(cls.parentClassName.toLowerCase())
          const classId = classMap.get(cls.name.toLowerCase())
          if (parentId && classId && parentId !== classId) {
            await tx
              .update(ontologyClasses)
              .set({ parent_class_id: parentId })
              .where(eq(ontologyClasses.id, classId))
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

      // Option B: Establish subClassOf relations for classes mapped via subClassOf
      for (const cls of draft.classes) {
        if (cls.alignment?.mode === "subClassOf" && cls.alignment.targetCurie) {
          const domainId = classMap.get(cls.name.toLowerCase())
          const targetCurieLower = cls.alignment.targetCurie.toLowerCase()
          const rangeId =
            classMap.get(targetCurieLower) ||
            classMap.get(
              (cls.alignment.targetCurie.split(":")[1] || "").toLowerCase()
            )

          if (domainId && rangeId) {
            const key = `subclassof:${domainId}:${rangeId}`
            if (!relationKeyMap.has(key)) {
              const [inserted] = await tx
                .insert(ontologyRelations)
                .values({
                  ontology_id: trimmedId,
                  name: "subClassOf",
                  domain_class_id: domainId,
                  range_class_id: rangeId,
                  description: `Inherits from standard vocabulary class ${cls.alignment.targetCurie}`,
                })
                .returning()

              if (inserted) {
                relationKeyMap.set(key, inserted.id)
                relationNameMap.set("subclassof", inserted.id)
                createdRelations++
              }
            }
          }
        }
      }

      // 4. Update CQ Mappings
      const existingCQs = await tx
        .select({ id: ontologyCompetencyQuestions.id })
        .from(ontologyCompetencyQuestions)
        .where(eq(ontologyCompetencyQuestions.ontology_id, trimmedId))

      const existingCqIdSet = new Set(existingCQs.map((cq) => cq.id))

      for (const mapping of draft.cqMappings) {
        // Skip mappings pointing to CQs that do not exist in this ontology
        if (!existingCqIdSet.has(mapping.cqId)) {
          continue
        }

        // Delete previous triples for this CQ
        await tx
          .delete(ontologyCqTriples)
          .where(eq(ontologyCqTriples.cq_id, mapping.cqId))

        let order = 0
        let firstSubId: string | null = null
        let firstPredId: string | null = null
        let firstObjId: string | null = null

        for (const t of mapping.triples ?? []) {
          const subId = classMap.get(t.subjectClassName.toLowerCase()) ?? null
          const predId =
            relationNameMap.get(t.predicateRelationName.toLowerCase()) ?? null
          const objId = classMap.get(t.objectClassName.toLowerCase()) ?? null

          if (order === 0) {
            firstSubId = subId
            firstPredId = predId
            firstObjId = objId
          }

          if (subId || predId || objId) {
            await tx.insert(ontologyCqTriples).values({
              cq_id: mapping.cqId,
              sort_order: order,
              subject_class_id: subId,
              predicate_relation_id: predId,
              object_class_id: objId,
            })
            order++
          }
        }

        if (firstSubId || firstPredId || firstObjId) {
          await tx
            .update(ontologyCompetencyQuestions)
            .set({
              subject_class_id: firstSubId,
              predicate_relation_id: firstPredId,
              object_class_id: firstObjId,
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
  } catch (error) {
    console.error("applyOntologyDraft failed:", error)
    throw error
  }

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
