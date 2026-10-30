import { getDb } from "@/server/db"
import { publishDomainEvent } from "@/server/events/outbox"
import type { DomainEventInput } from "@/server/events/types"

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
  options: ExtractionJobOptions = {}
) {
  const db = getDb()
  const payload = buildExtractionEventPayload(
    documentId,
    ontologyDocumentId,
    options
  )

  const result = await db.transaction(async (tx) => {
    return await publishDomainEvent(tx, payload, {
      priority: options.priority ?? 50,
      targetWorker: "extractor",
    })
  })

  return result
}
