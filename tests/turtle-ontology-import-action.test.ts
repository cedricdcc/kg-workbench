import assert from "node:assert/strict"
import { test } from "node:test"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { importOntologyFromTurtleInternal } from "../src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle"

test("importOntologyFromTurtleInternal parses Turtle and persists ontology transactionally", async () => {
  const minimalTtl = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <https://example.org/ns#> .

    <https://example.org/ns>
      a owl:Ontology ;
      rdfs:label "Minimal Example"@en .

    ex:Sensor a owl:Class .
  `

  const result = await importOntologyFromTurtleInternal({
    content: minimalTtl,
    fileName: "minimal.ttl",
  })

  assert.ok(result.ontologyId, "Should return an ontologyId")
  assert.ok(Array.isArray(result.warnings), "Should return warnings array")
})
