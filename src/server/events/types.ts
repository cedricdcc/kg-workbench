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
