"use server"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { knowledgeContradictions } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { DbOrTx } from "@/server/events/types"
import type {
  ContradictionConflictType,
  ContradictionStatus,
  KnowledgeContradiction,
  ResolveContradictionInput,
} from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function resolveContradictionAction(
  input: ResolveContradictionInput,
  dbInstance?: DbOrTx
): Promise<KnowledgeContradiction> {
  if (!input.contradictionId || !input.contradictionId.trim()) {
    throw new Error("contradictionId is required.")
  }

  if (input.status !== "resolved" && input.status !== "dismissed") {
    throw new Error(
      `Invalid status "${input.status}". Status must be either "resolved" or "dismissed".`
    )
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  const updateValues: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }

  if (input.actionNotes !== undefined) {
    updateValues.resolution_action = input.actionNotes
  }

  const [updated] = await (
    db as unknown as {
      update: (table: unknown) => {
        set: (values: unknown) => {
          where: (condition: unknown) => {
            returning: () => Promise<
              Array<typeof knowledgeContradictions.$inferSelect>
            >
          }
        }
      }
    }
  )
    .update(knowledgeContradictions)
    .set(updateValues)
    .where(
      and(
        eq(knowledgeContradictions.id, input.contradictionId.trim()),
        eq(knowledgeContradictions.group_key, groupKey)
      )
    )
    .returning()

  if (!updated) {
    throw new Error(
      `Knowledge contradiction "${input.contradictionId}" not found or inaccessible.`
    )
  }

  return {
    id: updated.id,
    ontologyId: updated.ontology_id || "",
    groupKey: updated.group_key,
    entityId: updated.entity_id,
    entityLabel: updated.entity_label,
    relationName: updated.relation_name,
    conflictType: updated.conflict_type as ContradictionConflictType,
    factA: (updated.fact_a as Record<string, unknown>) || {},
    factB: (updated.fact_b as Record<string, unknown>) || {},
    explanation: updated.explanation,
    status: updated.status as ContradictionStatus,
    resolutionAction: updated.resolution_action,
    createdAt: formatTimestamp(updated.created_at),
    updatedAt: formatTimestamp(updated.updated_at),
  }
}
