"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { datasetSources } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"
import { saveCanonicalOntology } from "@/features/ontology/server/linkml/document-store"
import type { DatasetMappingSpec } from "@/features/tabular/types"

export interface CommitDatasetMappingInput {
  ontologyId: string
  datasetSourceId?: string
  mappingSpec: DatasetMappingSpec
}

export interface CommitDatasetMappingResult {
  ok: boolean
  targetClassId: string
  createdClassesCount: number
  createdAttributesCount: number
  createdRelationsCount: number
}

export async function commitDatasetMappingAction(
  input: CommitDatasetMappingInput
): Promise<CommitDatasetMappingResult> {
  if (!input.ontologyId || !input.ontologyId.trim()) {
    throw new Error("ontologyId is required.")
  }
  if (!input.mappingSpec || !input.mappingSpec.targetClassName) {
    throw new Error(
      "Invalid mapping specification: targetClassName is required."
    )
  }

  await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = getDb()

  let targetClassId = input.mappingSpec.targetClassId || ""
  let createdClassesCount = 0
  let createdAttributesCount = 0
  let createdRelationsCount = 0

  await saveCanonicalOntology(
    input.ontologyId,
    (draft) => {
      draft.classes = draft.classes ?? []
      draft.attributes = draft.attributes ?? []
      draft.relations = draft.relations ?? []

      const classNameToIdMap = new Map<string, string>(
        draft.classes.map((c) => [c.name.toLowerCase(), c.id])
      )

      // 1. Synthesize new classes if specified
      const classesToCreate =
        input.mappingSpec.synthesizedElements?.classes || []
      for (const c of classesToCreate) {
        const lower = c.name.toLowerCase()
        if (!classNameToIdMap.has(lower)) {
          draft.classes.push({
            id: c.name,
            name: c.name,
            description: c.description || "",
            module_id: c.moduleId || input.mappingSpec.targetModuleId || null,
            instance_policy: "open",
          })
          classNameToIdMap.set(lower, c.name)
          createdClassesCount++
        }
      }

      // 2. Resolve or create target class
      if (!targetClassId) {
        const resolved = classNameToIdMap.get(
          input.mappingSpec.targetClassName.toLowerCase()
        )
        if (resolved) {
          targetClassId = resolved
        } else {
          const targetName = input.mappingSpec.targetClassName
          draft.classes.push({
            id: targetName,
            name: targetName,
            description: "Synthesized from dataset mapping",
            module_id: input.mappingSpec.targetModuleId || null,
            instance_policy: "open",
          })
          targetClassId = targetName
          classNameToIdMap.set(targetName.toLowerCase(), targetName)
          createdClassesCount++
        }
      }

      // 3. Synthesize new attributes
      const attributesToCreate =
        input.mappingSpec.synthesizedElements?.attributes || []
      for (const attr of attributesToCreate) {
        const parentClassId =
          classNameToIdMap.get(attr.className.toLowerCase()) || targetClassId
        if (parentClassId) {
          const alreadyExists = draft.attributes.some(
            (a) =>
              a.class_id === parentClassId &&
              a.name.toLowerCase() === attr.name.toLowerCase()
          )

          if (!alreadyExists) {
            draft.attributes.push({
              id: `${parentClassId}.${attr.name}`,
              class_id: parentClassId,
              name: attr.name,
              data_type: normalizeOntologyDataTypeOrDefault(attr.dataType),
            })
            createdAttributesCount++
          }
        }
      }

      // 4. Synthesize new relations
      const relationsToCreate =
        input.mappingSpec.synthesizedElements?.relations || []
      for (const rel of relationsToCreate) {
        const domainId =
          classNameToIdMap.get(rel.sourceClass.toLowerCase()) || targetClassId
        const rangeId = classNameToIdMap.get(rel.targetClass.toLowerCase())
        if (domainId && rangeId) {
          draft.relations.push({
            id: rel.name,
            name: rel.name,
            domain_class_id: domainId,
            range_class_id: rangeId,
            instance_policy: "open",
          })
          createdRelationsCount++
        }
      }
    },
    { db }
  )

  if (!targetClassId) {
    throw new Error(
      `Failed to resolve target class "${input.mappingSpec.targetClassName}".`
    )
  }

  // 5. Update dataset source mapping spec if datasetSourceId provided
  if (input.datasetSourceId) {
    await db
      .update(datasetSources)
      .set({
        mapping_spec: {
          ...input.mappingSpec,
          targetClassId,
        },
        updated_at: new Date().toISOString(),
      })
      .where(eq(datasetSources.id, input.datasetSourceId))
  }

  return {
    ok: true,
    targetClassId,
    createdClassesCount,
    createdAttributesCount,
    createdRelationsCount,
  }
}
