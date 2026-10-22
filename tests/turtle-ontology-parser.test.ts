import assert from "node:assert/strict"
import { test } from "node:test"
import { parseTurtleToImportOntology } from "../src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology"

const EMOBON_TTL = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dc: <http://purl.org/dc/elements/1.1/> . 
@prefix dct: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix vann: <http://purl.org/vocab/vann/> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix core: <https://data.emobon.embrc.eu/ns/core#> .

<https://data.emobon.embrc.eu/ns/core>
  a owl:Ontology ;
  owl:versionIRI <https://data.emobon.embrc.eu/ns/core.ttl> ;
  rdfs:label "The Core EMO-BON Ontology"@en ;
  rdfs:comment "The Core EMO-BON ontology provides definitions for the core classes and properties."@en ;
  vann:preferredNamespacePrefix "core" ;
  vann:preferredNamespaceUri "https://data.emobon.embrc.eu/ns/core#" .

schema:Thing a owl:Class .

<https://data.emobon.embrc.eu/ns/core#Observatory>
  a owl:Class ;
  rdfs:subClassOf schema:Thing, [
    a owl:Restriction ;
    owl:onProperty <https://data.emobon.embrc.eu/ns/core#broadBiome> ;
    owl:someValuesFrom <http://purl.obolibrary.org/obo/ENVO_00000428> ;
  ], [
    a owl:Restriction ;
    owl:onProperty <https://data.emobon.embrc.eu/ns/core#marineRegion> ;
    owl:qualifiedCardinality "1"^^xsd:nonNegativeInteger ;
    owl:onDataRange xsd:anyURI ;
  ] .

<http://purl.obolibrary.org/obo/ENVO_00000428> a owl:Class .

<https://data.emobon.embrc.eu/ns/core#SampleType>
  a owl:Class ;
  owl:equivalentClass [
    a owl:Class ;
    rdfs:subClassOf skos:Concept ;
    owl:oneOf (
      <https://data.emobon.embrc.eu/ns/core#Hard>
      <https://data.emobon.embrc.eu/ns/core#Soil>
      <https://data.emobon.embrc.eu/ns/core#Water>
    )
  ] .

<https://data.emobon.embrc.eu/ns/core#Hard> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .
<https://data.emobon.embrc.eu/ns/core#Soil> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .
<https://data.emobon.embrc.eu/ns/core#Water> 
  a owl:NamedIndividual, <https://data.emobon.embrc.eu/ns/core#SampleType> .

<https://data.emobon.embrc.eu/ns/core#hasBiome>
  a owl:ObjectProperty ;
  rdfs:domain <https://data.emobon.embrc.eu/ns/core#Observatory> ;
  rdfs:range <http://purl.obolibrary.org/obo/ENVO_00000428> .

<https://data.emobon.embrc.eu/ns/core#broadBiome>
  a owl:ObjectProperty ;
  rdfs:subPropertyOf <https://data.emobon.embrc.eu/ns/core#hasBiome> .

<https://data.emobon.embrc.eu/ns/core#marineRegion>
  a owl:DatatypeProperty ;
  rdfs:domain <https://data.emobon.embrc.eu/ns/core#Observatory> ;
  rdfs:range xsd:anyURI .
`

test("parseTurtleToImportOntology extracts metadata, classes, properties, restrictions, and individuals", () => {
  const result = parseTurtleToImportOntology(EMOBON_TTL)

  assert.equal(result.name, "The Core EMO-BON Ontology")
  assert.equal(result.version, "https://data.emobon.embrc.eu/ns/core.ttl")
  assert.ok(result.usecase.includes("core classes and properties"))

  // Classes
  const classNames = result.classes.map((c) => c.name)
  assert.ok(
    classNames.includes("Observatory"),
    "Observatory class should exist"
  )
  assert.ok(classNames.includes("SampleType"), "SampleType class should exist")
  assert.ok(
    classNames.includes("schema:Thing"),
    "schema:Thing class should exist"
  )
  assert.ok(
    classNames.includes("obo:ENVO_00000428") ||
      classNames.includes("ENVO_00000428"),
    "ENVO class should exist"
  )

  // Subclass
  const obsClass = result.classes.find((c) => c.name === "Observatory")!
  const thingClass = result.classes.find((c) => c.name === "schema:Thing")!
  assert.equal(obsClass.parentClassId, thingClass.id)

  // Attributes on Observatory
  const marineRegionAttr = obsClass.attributes.find(
    (a) => a.name === "marineRegion"
  )
  assert.ok(marineRegionAttr, "marineRegion attribute should exist")
  assert.equal(marineRegionAttr?.dataType, "xsd:anyURI")
  assert.equal(marineRegionAttr?.required, true)

  // Relations
  const hasBiomeRel = result.relations.find((r) => r.name === "hasBiome")
  assert.ok(hasBiomeRel, "hasBiome relation should exist")
  assert.equal(hasBiomeRel?.domainClassId, obsClass.id)

  // Individuals on SampleType
  const sampleTypeClass = result.classes.find((c) => c.name === "SampleType")!
  const candidateExamples = result.examples.filter(
    (e) => e.targetId === sampleTypeClass.id && e.isInstanceCandidate
  )
  assert.equal(candidateExamples.length, 3)
  const exampleValues = candidateExamples.map((e) => e.value)
  assert.ok(exampleValues.includes("Hard"))
  assert.ok(exampleValues.includes("Soil"))
  assert.ok(exampleValues.includes("Water"))
})
