"use server"

import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { knowledgeContradictions } from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import type { DbOrTx } from "@/server/events/types"
import type {
  ContradictionConflictType,
  ContradictionStatus,
  KnowledgeContradiction,
} from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function getContradictionsQuery(
  ontologyId: string,
  dbInstance?: DbOrTx
): Promise<KnowledgeContradiction[]> {
  if (!ontologyId || !ontologyId.trim()) {
    return []
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  const records = await (
    db as unknown as {
      select: () => {
        from: (table: unknown) => {
          where: (condition: unknown) => {
            orderBy: (
              order: unknown
            ) => Promise<Array<typeof knowledgeContradictions.$inferSelect>>
          }
        }
      }
    }
  )
    .select()
    .from(knowledgeContradictions)
    .where(
      and(
        eq(knowledgeContradictions.ontology_id, ontologyId.trim()),
        eq(knowledgeContradictions.group_key, groupKey)
      )
    )
    .orderBy(desc(knowledgeContradictions.created_at))

  return records.map((r) => ({
    id: r.id,
    ontologyId: r.ontology_id || "",
    groupKey: r.group_key,
    entityId: r.entity_id,
    entityLabel: r.entity_label,
    relationName: r.relation_name,
    conflictType: r.conflict_type as ContradictionConflictType,
    factA: (r.fact_a as Record<string, unknown>) || {},
    factB: (r.fact_b as Record<string, unknown>) || {},
    explanation: r.explanation,
    status: r.status as ContradictionStatus,
    resolutionAction: r.resolution_action,
    createdAt: formatTimestamp(r.created_at),
    updatedAt: formatTimestamp(r.updated_at),
  }))
}
