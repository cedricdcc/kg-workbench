"use server"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/server/database"
import {
  analystConversations,
  analystMessages,
  datasetSources,
  evidenceAnchors,
  factAnchors,
  facts,
  extractionRuns,
} from "@/server/db/schema"
import { getCurrentGroupKeyOrThrow } from "@/server/group-access"
import { publishDomainEvent } from "@/server/events/outbox"
import type { DbOrTx } from "@/server/events/types"
import type { SendQueryInput, SendQueryResult } from "../../types"

function formatTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return new Date().toISOString()
}

export async function sendQueryAction(
  input: SendQueryInput,
  dbInstance?: DbOrTx
): Promise<SendQueryResult> {
  if (!input.conversationId || !input.conversationId.trim()) {
    throw new Error("conversationId is required.")
  }
  if (!input.ontologyId || !input.ontologyId.trim()) {
    throw new Error("ontologyId is required.")
  }
  if (!input.query || !input.query.trim()) {
    throw new Error("query is required.")
  }

  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")
  const db = dbInstance ?? getDb()

  const runWithTx = async (tx: DbOrTx): Promise<SendQueryResult> => {
    // 1. Insert user message into analystMessages
    const [insertedMessage] = await (
      tx as unknown as {
        insert: (table: unknown) => {
          values: (val: unknown) => {
            returning: () => Promise<Array<typeof analystMessages.$inferSelect>>
          }
        }
      }
    )
      .insert(analystMessages)
      .values({
        conversation_id: input.conversationId.trim(),
        sender: "user",
        content: input.query.trim(),
      })
      .returning()

    if (!insertedMessage) {
      throw new Error("Failed to persist analyst query message.")
    }

    // Touch conversation updated_at
    try {
      await (
        tx as unknown as {
          update: (table: unknown) => {
            set: (val: unknown) => {
              where: (condition: unknown) => Promise<unknown>
            }
          }
        }
      )
        .update(analystConversations)
        .set({ updated_at: new Date().toISOString() })
        .where(eq(analystConversations.id, input.conversationId.trim()))
    } catch {
      // Mock or non-essential update failure tolerated
    }

    // 2. Fetch accepted facts and associated anchors for the ontology
    let factsList: Array<Record<string, unknown>> = []
    let anchorsList: Array<Record<string, unknown>> = []

    try {
      const factRows = await (
        tx as unknown as {
          select: (fields?: unknown) => {
            from: (table: unknown) => {
              innerJoin: (
                joinTable: unknown,
                onCond: unknown
              ) => {
                where: (
                  condition: unknown
                ) => Promise<Array<Record<string, unknown>>>
              }
            }
          }
        }
      )
        .select({
          id: facts.id,
          subject_text: facts.subject_text,
          relation_text: facts.relation_text,
          object_text: facts.object_text,
          subject_entity_id: facts.subject_entity_id,
          object_entity_id: facts.object_entity_id,
          relation_type_id: facts.relation_type_id,
          review_status: facts.review_status,
          confidence: facts.confidence,
          document_id: facts.document_id,
          primary_anchor_id: facts.primary_anchor_id,
          created_at: facts.created_at,
        })
        .from(facts)
        .innerJoin(
          extractionRuns,
          eq(facts.extraction_run_id, extractionRuns.id)
        )
        .where(
          and(
            eq(extractionRuns.ontology_id, input.ontologyId.trim()),
            eq(facts.review_status, "accepted")
          )
        )

      if (Array.isArray(factRows)) {
        factsList = factRows
        const factIds = factRows
          .map((f) => (f as { id?: string }).id)
          .filter((id): id is string => Boolean(id))

        if (factIds.length > 0) {
          try {
            const anchorRows = await (
              tx as unknown as {
                select: (fields?: unknown) => {
                  from: (table: unknown) => {
                    innerJoin: (
                      joinTable: unknown,
                      onCond: unknown
                    ) => {
                      where: (
                        condition: unknown
                      ) => Promise<Array<Record<string, unknown>>>
                    }
                  }
                }
              }
            )
              .select({
                fact_id: factAnchors.fact_id,
                anchor_id: evidenceAnchors.id,
                document_id: evidenceAnchors.document_id,
                paragraph_id: evidenceAnchors.paragraph_id,
                quote_text: evidenceAnchors.quote_text,
                context_text: evidenceAnchors.context_text,
                page_from: evidenceAnchors.page_from,
                page_to: evidenceAnchors.page_to,
              })
              .from(factAnchors)
              .innerJoin(
                evidenceAnchors,
                eq(factAnchors.anchor_id, evidenceAnchors.id)
              )
              .where(inArray(factAnchors.fact_id, factIds))

            if (Array.isArray(anchorRows)) {
              anchorsList = anchorRows
            }
          } catch {
            anchorsList = []
          }
        }
      }
    } catch {
      factsList = []
      anchorsList = []
    }

    // 3. Fetch mapped dataset sources for the ontology
    let datasetsList: Array<Record<string, unknown>> = []
    try {
      const datasetRows = await (
        tx as unknown as {
          select: () => {
            from: (table: unknown) => {
              where: (
                condition: unknown
              ) => Promise<Array<typeof datasetSources.$inferSelect>>
            }
          }
        }
      )
        .select()
        .from(datasetSources)
        .where(
          and(
            eq(datasetSources.ontology_id, input.ontologyId.trim()),
            eq(datasetSources.group_key, groupKey)
          )
        )

      if (Array.isArray(datasetRows)) {
        datasetsList = datasetRows.map((ds) => ({
          id: ds.id,
          sourceName: ds.source_name,
          fileFormat: ds.file_format,
          rowCount: ds.row_count,
          columnCount: ds.column_count,
          profileSummary: ds.profile_summary,
          sampleRows: ds.sample_rows,
          mappingSpec: ds.mapping_spec,
        }))
      }
    } catch {
      datasetsList = []
    }

    // 4. Publish domain event to job queue
    const { eventId, jobId } = await publishDomainEvent(tx, {
      eventType: "analyst.query_requested",
      aggregateType: "ontology",
      aggregateId: input.ontologyId.trim(),
      payload: {
        conversationId: input.conversationId.trim(),
        query: input.query.trim(),
        facts: factsList,
        anchors: anchorsList,
        datasets: datasetsList,
      },
    })

    return {
      userMessage: {
        id: insertedMessage.id,
        conversationId: insertedMessage.conversation_id,
        sender: insertedMessage.sender as "user",
        content: insertedMessage.content,
        createdAt: formatTimestamp(insertedMessage.created_at),
      },
      jobId,
      eventId,
    }
  }

  if (dbInstance) {
    if (
      "transaction" in dbInstance &&
      typeof dbInstance.transaction === "function"
    ) {
      return await (
        dbInstance as {
          transaction: (
            cb: (tx: DbOrTx) => Promise<SendQueryResult>
          ) => Promise<SendQueryResult>
        }
      ).transaction(runWithTx)
    }
    return await runWithTx(dbInstance)
  }

  return await (
    db as {
      transaction: (
        cb: (tx: DbOrTx) => Promise<SendQueryResult>
      ) => Promise<SendQueryResult>
    }
  ).transaction(runWithTx)
}
