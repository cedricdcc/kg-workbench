import { config } from "dotenv"
config({ path: ".env.local" })

import assert from "node:assert/strict"
import { test } from "node:test"
import { getDb } from "../src/server/db"
import { publishDomainEvent } from "../src/server/events/outbox"
import { fastPathAwaitJob } from "../src/server/events/queue"
import type { ReasonerResultPayload } from "../src/features/ontology/server/actions/run-ontology-reasoning"

test("live reasoner worker claims and validates ontology job from job_queue", async () => {
  const db = getDb()

  const dataGraph = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix : <http://example.org/smoke#> .

<http://example.org/smoke> a owl:Ontology .

:Vehicle a owl:Class .
:Car a owl:Class ;
    rdfs:subClassOf :Vehicle .

:myCar a :Car .
`

  const shapesGraph = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix : <http://example.org/smoke#> .

:VehicleShape a sh:NodeShape ;
    sh:targetClass :Vehicle .
`

  const testOntologyId = "a0000000-0000-4000-8000-000000000001"

  // 1. Enqueue job
  const { jobId } = await publishDomainEvent(
    db,
    {
      eventType: "ontology.validation_requested",
      aggregateType: "ontology",
      aggregateId: testOntologyId,
      payload: {
        ontologyId: testOntologyId,
        dataGraph,
        shapesGraph,
        inference: "rdfs",
      },
    },
    { priority: 100, targetWorker: "reasoner" }
  )

  assert.ok(jobId, "jobId should be created")

  // 2. Await worker pickup and completion (up to 8,000ms)
  const outcome = await fastPathAwaitJob<ReasonerResultPayload>(
    db,
    jobId,
    8000,
    150
  )

  assert.equal(outcome.resolved, true, "Job should resolve within timeout")
  assert.equal(outcome.status, "completed", "Job status should be completed")
  assert.ok(outcome.result, "Job should contain a result payload")
  assert.equal(outcome.result.conforms, true, "Graph should conform to shapes")
  assert.equal(outcome.result.violationCount, 0, "Violations should be 0")
  assert.ok(outcome.result.processedBy, "Should include worker identifier")
  assert.ok(
    outcome.result.processedBy.toLowerCase().includes("reasoner"),
    `Worker id '${outcome.result.processedBy}' should mention reasoner`
  )
})
