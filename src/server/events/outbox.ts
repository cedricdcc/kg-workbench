import { domainEvents, jobQueue } from "../db/schema"
import type {
  DomainEventInput,
  PublishEventOptions,
  PublishedEventResult,
} from "./types"

const EVENT_WORKER_ROUTING: Record<string, string> = {
  "extraction.requested": "extractor",
  "ontology.change_proposed": "reasoner",
  "ontology.validation_requested": "reasoner",
  "source.sync_requested": "tabular",
  "analyst.query_requested": "analyst",
}

export function resolveTargetWorker(eventType: string): string {
  return EVENT_WORKER_ROUTING[eventType] ?? "default"
}

export async function publishDomainEvent(
  tx: any,
  event: DomainEventInput,
  options?: PublishEventOptions
): Promise<PublishedEventResult> {
  const [createdEvent] = await tx
    .insert(domainEvents)
    .values({
      event_type: event.eventType,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
    })
    .returning({ id: domainEvents.id })

  const eventId = createdEvent?.id

  const targetWorker =
    options?.targetWorker || resolveTargetWorker(event.eventType)
  const priority = options?.priority ?? 0

  const [createdJob] = await tx
    .insert(jobQueue)
    .values({
      event_id: eventId,
      target_worker: targetWorker,
      priority,
      status: "pending",
    })
    .returning({ id: jobQueue.id })

  const jobId = createdJob?.id

  return { eventId, jobId }
}
