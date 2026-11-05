"use server"

import { getDb } from "@/server/db"
import { getServiceRegistryStatuses } from "@/server/events/services"
import { publishDomainEvent } from "@/server/events/outbox"
import { fastPathAwaitJob } from "@/server/events/queue"
import { buildOntologyExport } from "./ontology-transfer"
import { buildShaclShapes } from "../shacl/generator"
import { serializeOntologyTurtle } from "../shacl/serialize-ontology-turtle"

export type ReasonerJobViolation = {
  severity: "Violation" | "Warning" | "Info"
  focusNode: string
  message: string
  source: string
}

export type InferredTriple = {
  subject: string
  predicate: string
  object: string
  derivation: string
}

export type ReasonerResultPayload = {
  conforms: boolean
  violationCount: number
  violations: ReasonerJobViolation[]
  inferredTriples: InferredTriple[]
  reportText: string
  processedBy?: string
}

export type ReasonerActionResponse =
  | {
      status: "completed"
      jobId: string
      result: ReasonerResultPayload
    }
  | {
      status: "pending"
      jobId: string
    }
  | {
      status: "failed"
      jobId: string
      error: string
    }
  | {
      status: "offline"
      message: string
      composeCommand: string
    }

export async function requestOntologyReasoningAction(
  ontologyId: string
): Promise<ReasonerActionResponse> {
  const db = getDb()

  // 1. Check if Reasoner service is online
  const services = await getServiceRegistryStatuses(db)
  const reasonerService = services.find((s) => s.id === "reasoner")

  if (!reasonerService || reasonerService.status === "offline") {
    return {
      status: "offline",
      message: "Reasoner microservice is currently offline or unreachable.",
      composeCommand: "bash deploy/scripts/deploy.sh postgres up --profile reasoner",
    }
  }

  // 2. Fetch full ontology data
  const jsonExport = await buildOntologyExport({
    ontologyId,
    includeVisual: false,
  })

  const ontologyPayload = jsonExport.payload
  const baseIri = ontologyPayload.baseIri || "http://example.org/onto#"

  // 3. Serialize to Turtle and SHACL shapes
  const dataGraph = serializeOntologyTurtle({
    name: ontologyPayload.name,
    baseIri,
    classes: ontologyPayload.classes,
    relations: ontologyPayload.relations,
    attributes: ontologyPayload.attributes,
    disjointness: ontologyPayload.disjointness,
    examples: ontologyPayload.examples,
  })

  const shapesGraph = buildShaclShapes({
    baseIri,
    ontology: ontologyPayload,
    closed: false,
  })

  // 4. Publish domain event & job queue row
  const { jobId } = await publishDomainEvent(
    db,
    {
      eventType: "ontology.validation_requested",
      aggregateType: "ontology",
      aggregateId: ontologyId,
      payload: {
        ontologyId,
        dataGraph,
        shapesGraph,
        inference: "rdfs",
      },
    },
    { priority: 100, targetWorker: "reasoner" }
  )

  // 5. Fast-Path Await (2,000ms window)
  const awaitRes = await fastPathAwaitJob<ReasonerResultPayload>(
    db,
    jobId,
    2000,
    100
  )

  if (awaitRes.resolved && awaitRes.status === "completed" && awaitRes.result) {
    return {
      status: "completed",
      jobId,
      result: awaitRes.result,
    }
  }

  if (awaitRes.resolved && awaitRes.status === "failed") {
    return {
      status: "failed",
      jobId,
      error: awaitRes.error || "Reasoner job failed",
    }
  }

  return {
    status: "pending",
    jobId,
  }
}
