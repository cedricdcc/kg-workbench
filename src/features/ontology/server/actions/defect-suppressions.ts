"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import { ontologyDefectSuppressions } from "@/server/db/schema"
import { assertOntologyDocumentAccess } from "@/server/group-access"

export async function toggleDefectSuppression(
  ontologyId: string,
  defectId: string,
  suppress: boolean
): Promise<{ success: boolean }> {
  const trimmedOntologyId = ontologyId?.trim()
  if (!trimmedOntologyId) {
    throw new Error("Ontology ID is required.")
  }

  const trimmedDefectId = defectId?.trim()
  if (!trimmedDefectId) {
    throw new Error("Defect ID is required.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(trimmedOntologyId, db)

  if (suppress) {
    const existing = await db
      .select({ id: ontologyDefectSuppressions.id })
      .from(ontologyDefectSuppressions)
      .where(
        and(
          eq(ontologyDefectSuppressions.ontology_id, trimmedOntologyId),
          eq(ontologyDefectSuppressions.defect_id, trimmedDefectId)
        )
      )

    if (existing.length === 0) {
      await db.insert(ontologyDefectSuppressions).values({
        ontology_id: trimmedOntologyId,
        defect_id: trimmedDefectId,
      })
    }
  } else {
    await db
      .delete(ontologyDefectSuppressions)
      .where(
        and(
          eq(ontologyDefectSuppressions.ontology_id, trimmedOntologyId),
          eq(ontologyDefectSuppressions.defect_id, trimmedDefectId)
        )
      )
  }

  revalidatePath(routes.ontology.root)
  return { success: true }
}
