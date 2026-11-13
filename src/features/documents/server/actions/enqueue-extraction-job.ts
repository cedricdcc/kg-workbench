import type { AnyDbClient } from "@/features/ontology/server/linkml/document-store"
import { getDb } from "@/server/db"
import { publishDomainEvent } from "@/server/events/outbox"
import type { DbOrTx, DomainEventInput } from "@/server/events/types"
import type { ExtractionLinkmlArtifacts } from "@/server/external/extraction-api"

import { resolveExtractionOntologyArtifacts } from "./build-extraction-artifacts"

export type ExtractionJobOptions = {
  provider?: string
  model?: string
  apiKey?: string
  priority?: number
  artifacts?: ExtractionLinkmlArtifacts | null
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
      ...(options.artifacts ?? {}),
    },
  }
}

function hasSelectMethod(client: unknown): client is AnyDbClient {
  return (
    typeof client === "object" &&
    client !== null &&
    "select" in client &&
    typeof (client as { select?: unknown }).select === "function"
  )
}

export async function enqueueExtractionJob(
  documentId: string,
  ontologyDocumentId: string,
  options: ExtractionJobOptions = {},
  tx?: DbOrTx
) {
  const publishOpts = {
    priority: options.priority ?? 50,
    targetWorker: "extractor",
  }

  if (tx) {
    const resolvedArtifacts =
      options.artifacts === undefined && hasSelectMethod(tx)
        ? await resolveExtractionOntologyArtifacts(ontologyDocumentId, tx)
        : options.artifacts
    const payload = buildExtractionEventPayload(
      documentId,
      ontologyDocumentId,
      {
        ...options,
        ...(resolvedArtifacts !== undefined
          ? { artifacts: resolvedArtifacts }
          : {}),
      }
    )
    return await publishDomainEvent(tx, payload, publishOpts)
  }

  const db = getDb()
  const resolvedArtifacts =
    options.artifacts === undefined
      ? await resolveExtractionOntologyArtifacts(
          ontologyDocumentId,
          db as unknown as AnyDbClient
        )
      : options.artifacts
  const payload = buildExtractionEventPayload(documentId, ontologyDocumentId, {
    ...options,
    ...(resolvedArtifacts !== undefined
      ? { artifacts: resolvedArtifacts }
      : {}),
  })

  const result = await db.transaction(async (transactionTx) => {
    return await publishDomainEvent(transactionTx, payload, publishOpts)
  })

  return result
}
