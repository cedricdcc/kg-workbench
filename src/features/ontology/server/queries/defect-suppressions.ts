import { eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { ontologyDefectSuppressions } from "@/server/db/schema"
import { assertOntologyDocumentAccess } from "@/server/group-access"

export async function getDefectSuppressions(
  ontologyId: string
): Promise<string[]> {
  const trimmedId = ontologyId?.trim()
  if (!trimmedId) {
    throw new Error("Ontology ID is required.")
  }

  const db = getDb()
  await assertOntologyDocumentAccess(trimmedId, db)

  const rows = await db
    .select({ defectId: ontologyDefectSuppressions.defect_id })
    .from(ontologyDefectSuppressions)
    .where(eq(ontologyDefectSuppressions.ontology_id, trimmedId))

  return rows.map((r) => r.defectId)
}
