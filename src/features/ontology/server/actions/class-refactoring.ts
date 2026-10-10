"use server"

import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import {
  ontologyAttributes,
  ontologyClasses,
  ontologyRelations,
} from "@/server/db/schema"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
} from "@/server/group-access"
import { validateHierarchyAcyclicity } from "@/features/ontology/utils/hierarchy-validation"

export const ReparentClassInputSchema = z.object({
  ontologyId: z.string().uuid(),
  classId: z.string().uuid(),
  targetParentClassId: z.string().uuid().nullable().optional(),
  dropAttributeIds: z.array(z.string().uuid()).optional(),
})

export type ReparentClassInput = z.infer<typeof ReparentClassInputSchema>

export const MergeClassesInputSchema = z.object({
  ontologyId: z.string().uuid(),
  sourceClassId: z.string().uuid(),
  targetClassId: z.string().uuid(),
  retainedAttributeIds: z.array(z.string().uuid()).optional(),
})

export type MergeClassesInput = z.infer<typeof MergeClassesInputSchema>

export async function refactorClassHierarchy(
  input: ReparentClassInput
): Promise<{ classId: string }> {
  const validated = ReparentClassInputSchema.parse(input)
  const db = getDb()

  await assertOntologyDocumentAccess(validated.ontologyId, db)
  await assertOntologyRecordAccess("ontology_classes", validated.classId, db)

  if (
    validated.targetParentClassId &&
    validated.targetParentClassId === validated.classId
  ) {
    throw new Error("A class cannot be its own parent.")
  }

  // Check hierarchy cycle
  if (validated.targetParentClassId) {
    const allClasses = await db
      .select({
        id: ontologyClasses.id,
        parent_class_id: ontologyClasses.parent_class_id,
      })
      .from(ontologyClasses)
      .where(eq(ontologyClasses.ontology_id, validated.ontologyId))

    const cycleCheck = validateHierarchyAcyclicity(
      validated.classId,
      validated.targetParentClassId,
      allClasses
    )

    if (!cycleCheck.valid) {
      throw new Error(
        `Hierarchy cycle detected: ${cycleCheck.cyclePath?.join(" → ")}`
      )
    }
  }

  await db.transaction(async (tx) => {
    // 1. Update parent class
    await tx
      .update(ontologyClasses)
      .set({
        parent_class_id: validated.targetParentClassId ?? null,
      })
      .where(
        and(
          eq(ontologyClasses.id, validated.classId),
          eq(ontologyClasses.ontology_id, validated.ontologyId)
        )
      )

    // 2. Drop redundant attributes if requested
    if (validated.dropAttributeIds && validated.dropAttributeIds.length > 0) {
      await tx
        .delete(ontologyAttributes)
        .where(
          and(
            eq(ontologyAttributes.class_id, validated.classId),
            inArray(ontologyAttributes.id, validated.dropAttributeIds)
          )
        )
    }
  })

  revalidatePath(routes.ontology.root)
  return { classId: validated.classId }
}

export async function mergeClasses(input: MergeClassesInput): Promise<{
  targetClassId: string
  migratedRelations: number
  migratedFacts: number
}> {
  const validated = MergeClassesInputSchema.parse(input)
  if (validated.sourceClassId === validated.targetClassId) {
    throw new Error("Cannot merge a class into itself.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(validated.ontologyId, db)
  await assertOntologyRecordAccess(
    "ontology_classes",
    validated.sourceClassId,
    db
  )
  await assertOntologyRecordAccess(
    "ontology_classes",
    validated.targetClassId,
    db
  )

  let migratedRelations = 0

  await db.transaction(async (tx) => {
    // 1. Migrate relations where sourceClass is domain
    const domainUpdate = await tx
      .update(ontologyRelations)
      .set({
        domain_class_id: validated.targetClassId,
      })
      .where(
        and(
          eq(ontologyRelations.ontology_id, validated.ontologyId),
          eq(ontologyRelations.domain_class_id, validated.sourceClassId)
        )
      )
      .returning({ id: ontologyRelations.id })

    // 2. Migrate relations where sourceClass is range
    const rangeUpdate = await tx
      .update(ontologyRelations)
      .set({
        range_class_id: validated.targetClassId,
      })
      .where(
        and(
          eq(ontologyRelations.ontology_id, validated.ontologyId),
          eq(ontologyRelations.range_class_id, validated.sourceClassId)
        )
      )
      .returning({ id: ontologyRelations.id })

    migratedRelations = domainUpdate.length + rangeUpdate.length

    // 3. Move retained attributes to target class
    if (
      validated.retainedAttributeIds &&
      validated.retainedAttributeIds.length > 0
    ) {
      await tx
        .update(ontologyAttributes)
        .set({
          class_id: validated.targetClassId,
        })
        .where(
          and(
            eq(ontologyAttributes.class_id, validated.sourceClassId),
            inArray(ontologyAttributes.id, validated.retainedAttributeIds)
          )
        )
    }

    // 4. Delete remaining source class attributes
    await tx
      .delete(ontologyAttributes)
      .where(eq(ontologyAttributes.class_id, validated.sourceClassId))

    // 5. Update any child classes of source to now point to target
    await tx
      .update(ontologyClasses)
      .set({
        parent_class_id: validated.targetClassId,
      })
      .where(
        and(
          eq(ontologyClasses.ontology_id, validated.ontologyId),
          eq(ontologyClasses.parent_class_id, validated.sourceClassId)
        )
      )

    // 6. Delete source class
    await tx
      .delete(ontologyClasses)
      .where(
        and(
          eq(ontologyClasses.id, validated.sourceClassId),
          eq(ontologyClasses.ontology_id, validated.ontologyId)
        )
      )
  })

  revalidatePath(routes.ontology.root)
  return {
    targetClassId: validated.targetClassId,
    migratedRelations,
    migratedFacts: 0,
  }
}
