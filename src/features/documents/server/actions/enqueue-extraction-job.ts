import { getDb } from "@/server/db"
import { publishDomainEvent } from "@/server/events/outbox"
import type { DbOrTx, DomainEventInput } from "@/server/events/types"

export type ExtractionJobOptions = {
  provider?: string
  model?: string
  apiKey?: string
  priority?: number
}

export function buildExtractionEventPayload(
  documentId: string,
  ontologyDocumentId: string,
  options: ExtractionJobOptions
): DomainEventInput {
  return {
    eventType: "extraction.requested",
    aggregateType: "document",
    aggregateId: documentId,
    payload: {
      documentId,
      ontologyDocumentId,
      provider: options.provider ?? "ollama",
      model: options.model,
      apiKey: options.apiKey,
    },
  }
}

export async function enqueueExtractionJob(
  documentId: string,
  ontologyDocumentId: string,
  options: ExtractionJobOptions = {},
  tx?: DbOrTx
) {
  const payload = buildExtractionEventPayload(
    documentId,
    ontologyDocumentId,
    options
  )

  const publishOpts = {
    priority: options.priority ?? 50,
    targetWorker: "extractor",
  }

  if (tx) {
    return await publishDomainEvent(tx, payload, publishOpts)
  }

  const db = getDb()
  const result = await db.transaction(async (transactionTx) => {
    return await publishDomainEvent(transactionTx, payload, publishOpts)
  })

  return result
}
