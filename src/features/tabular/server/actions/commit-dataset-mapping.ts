"use server"

import { eq, inArray } from "drizzle-orm"
import { getDb } from "@/server/database"
import {
  datasetSources,
  ontologyAttributes,
  ontologyClasses,
  ontologyRelations,
} from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
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

  return await db.transaction(async (tx) => {
    // 1. Fetch existing classes in this ontology
    const existingClasses = await tx
      .select()
      .from(ontologyClasses)
      .where(eq(ontologyClasses.ontology_id, input.ontologyId))

    const classNameToIdMap = new Map<string, string>(
      existingClasses.map((c) => [c.name.toLowerCase(), c.id])
    )

    let createdClassesCount = 0
    let createdAttributesCount = 0
    let createdRelationsCount = 0

    // 2. Synthesize new classes if specified
    const classesToCreate = input.mappingSpec.synthesizedElements?.classes || []
    for (const c of classesToCreate) {
      const lower = c.name.toLowerCase()
      if (!classNameToIdMap.has(lower)) {
        const [inserted] = await tx
          .insert(ontologyClasses)
          .values({
            ontology_id: input.ontologyId,
            name: c.name,
            description: c.description || "",
            module_id: c.moduleId || input.mappingSpec.targetModuleId || null,
          })
          .returning()

        if (inserted) {
          classNameToIdMap.set(lower, inserted.id)
          createdClassesCount++
        }
      }
    }

    // Resolve or create target class
    let targetClassId = input.mappingSpec.targetClassId
    if (!targetClassId) {
      const resolved = classNameToIdMap.get(
        input.mappingSpec.targetClassName.toLowerCase()
      )
      if (resolved) {
        targetClassId = resolved
      } else {
        const [createdTarget] = await tx
          .insert(ontologyClasses)
          .values({
            ontology_id: input.ontologyId,
            name: input.mappingSpec.targetClassName,
            description: `Synthesized from dataset mapping`,
            module_id: input.mappingSpec.targetModuleId || null,
          })
          .returning()
        if (createdTarget) {
          targetClassId = createdTarget.id
          classNameToIdMap.set(
            input.mappingSpec.targetClassName.toLowerCase(),
            createdTarget.id
          )
          createdClassesCount++
        }
      }
    }

    if (!targetClassId) {
      throw new Error(
        `Failed to resolve target class "${input.mappingSpec.targetClassName}".`
      )
    }

    // 3. Synthesize new attributes
    const attributesToCreate =
      input.mappingSpec.synthesizedElements?.attributes || []
    for (const attr of attributesToCreate) {
      const parentClassId =
        classNameToIdMap.get(attr.className.toLowerCase()) || targetClassId
      if (parentClassId) {
        // Check if attribute already exists on this class
        const existingAttr = await tx
          .select()
          .from(ontologyAttributes)
          .where(eq(ontologyAttributes.class_id, parentClassId))

        const alreadyExists = existingAttr.some(
          (a) => a.name.toLowerCase() === attr.name.toLowerCase()
        )

        if (!alreadyExists) {
          await tx.insert(ontologyAttributes).values({
            class_id: parentClassId,
            name: attr.name,
            data_type: attr.dataType || "xsd:string",
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
        await tx.insert(ontologyRelations).values({
          ontology_id: input.ontologyId,
          name: rel.name,
          domain_class_id: domainId,
          range_class_id: rangeId,
        })
        createdRelationsCount++
      }
    }

    // 5. Update dataset source mapping spec if datasetSourceId provided
    if (input.datasetSourceId) {
      await tx
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
  })
}
