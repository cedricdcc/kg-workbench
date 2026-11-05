"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/server/db"
import { ontologyClassDisjointness } from "@/server/db/schema"
import { getServiceRegistryStatuses } from "@/server/events/services"
import { publishDomainEvent } from "@/server/events/outbox"
import { fastPathAwaitJob } from "@/server/events/queue"
import {
  getOntologyClasses,
  getOntologyDocument,
  getOntologyExamplesByOntology,
  getOntologyRelations,
} from "../queries"
import { normalizeOntologyDataTypeOrDefault } from "@/features/ontology/utils/data-types"
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
  const [classes, relations, ontologyDoc, disjointnessRows, examples] =
    await Promise.all([
      getOntologyClasses(ontologyId),
      getOntologyRelations(ontologyId),
      getOntologyDocument(ontologyId),
      db
        .select()
        .from(ontologyClassDisjointness)
        .where(eq(ontologyClassDisjointness.ontology_id, ontologyId)),
      getOntologyExamplesByOntology(ontologyId),
    ])

  const baseIri = "http://example.org/onto#"

  // 3. Serialize to Turtle and SHACL shapes
  const dataGraph = serializeOntologyTurtle({
    name: ontologyDoc.name,
    baseIri,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      parentClassId: c.parent_class_id,
      description: c.description,
    })),
    relations: relations.map((r) => ({
      id: r.id,
      name: r.name,
      sourceClassId: r.domain_class_id,
      targetClassId: r.range_class_id,
    })),
    attributes: classes.flatMap((c) =>
      c.attributes.map((a) => ({
        id: a.id,
        classId: c.id,
        name: a.name,
        dataType: a.data_type,
        isRequired: a.required ?? undefined,
      }))
    ),
    disjointness: disjointnessRows.map((d) => ({
      classId: d.class_id,
      disjointClassId: d.disjoint_class_id,
    })),
    examples: examples
      .filter((e) => Boolean(e.target_class_id))
      .map((e) => ({
        id: e.id,
        classId: e.target_class_id!,
        value: e.value,
      })),
  })

  const shapesGraph = buildShaclShapes({
    baseIri,
    ontology: {
      name: ontologyDoc.name,
      defaultLanguage: ontologyDoc.default_language ?? "en",
      languages: [],
      usecase: ontologyDoc.usecase ?? "",
      modules: ontologyDoc.modules.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description ?? "",
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        moduleId: c.module_id,
        description: c.description ?? "",
        parentClassId: c.parent_class_id,
        attributes: c.attributes.map((a) => ({
          id: a.id,
          name: a.name,
          dataType: normalizeOntologyDataTypeOrDefault(a.data_type),
          required: a.required ?? false,
          description: a.description ?? "",
        })),
      })),
      relations: relations.map((r) => ({
        id: r.id,
        name: r.name,
        domainClassId: r.domain_class_id,
        rangeClassId: r.range_class_id,
        description: r.description ?? "",
        cardinality: r.cardinality,
      })),
      relationAttributes: [],
      competencyQuestions: [],
      notes: [],
      examples: [],
      localizedTexts: [],
    },
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

  // 5. Fast-Path Await (3,500ms window)
  const awaitRes = await fastPathAwaitJob<ReasonerResultPayload>(
    db,
    jobId,
    3500,
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
