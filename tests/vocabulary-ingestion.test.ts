import assert from "node:assert/strict"
import { test } from "node:test"
import { parseRdfTurtle } from "../src/features/ontology/server/services/vocabulary-ingestion/rdf-parser"

test("parseRdfTurtle parses classes and properties with domain and range", () => {
  const ttl = `
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix ex: <http://example.org/sensor#> .

    <http://example.org/sensor> a owl:Ontology ;
      rdfs:label "Sensor Vocabulary" .

    ex:Sensor a owl:Class ;
      rdfs:label "Sensor" ;
      rdfs:comment "A sensor device." .

    ex:observes a owl:ObjectProperty ;
      rdfs:label "observes" ;
      rdfs:domain ex:Sensor ;
      rdfs:range ex:Property .

    ex:batteryLevel a owl:DatatypeProperty ;
      rdfs:label "batteryLevel" ;
      rdfs:domain ex:Sensor .
  `
  const result = parseRdfTurtle(ttl)
  assert.equal(result.prefix, "sensor")
  assert.equal(result.terms.length, 3)

  const sensor = result.terms.find((t) => t.label === "Sensor")
  assert.ok(sensor)
  assert.equal(sensor.type, "class")

  const prop = result.terms.find((t) => t.label === "observes")
  assert.ok(prop)
  assert.equal(prop.type, "property")
  assert.equal(prop.propertyKind, "object")
  assert.ok(prop.domainIris.includes("http://example.org/sensor#Sensor"))
})
