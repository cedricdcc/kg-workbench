import type { getDb } from "../db"

export type DatabaseInstance = ReturnType<typeof getDb>
export type TransactionInstance = Parameters<
  Parameters<DatabaseInstance["transaction"]>[0]
>[0]
export type DbOrTx = DatabaseInstance | TransactionInstance

export type DomainEventInput = {
  eventType: string
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
}

export type PublishEventOptions = {
  priority?: number
  targetWorker?: string
}

export type PublishedEventResult = {
  eventId: string
  jobId: string
}
