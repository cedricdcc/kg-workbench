import assert from "node:assert/strict"
import { test } from "node:test"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { linkmlYamlToSnapshot } from "../src/features/ontology/server/linkml/ast-mapper"
import { compileSnapshotArtifacts } from "../src/features/ontology/server/linkml/compiler"
import { loadLinkmlRuntime } from "../src/features/ontology/server/linkml/runtime"
import { buildShaclShapes } from "../src/features/ontology/server/shacl/generator"
import { parseTurtleToImportOntology } from "../src/features/ontology/server/services/turtle-importer/parse-turtle-to-import-ontology"
import {
  exportOntologyArtifactsAction,
  type OntologyArtifactFormat,
} from "../src/features/ontology/server/actions/export-ontology-artifacts"
import { buildOntologyShaclExport } from "../src/features/ontology/server/actions/ontology-shacl-export"
import { buildOntologyOwlExport } from "../src/features/ontology/server/actions/ontology-owl-export"
import { importOntologyFromTurtleInternal } from "../src/features/ontology/server/actions/ontology-transfer/import-ontology-from-turtle"
import type { ImportOntology } from "../src/features/ontology/schemas/import"

const SAMPLE_OWL_TURTLE = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <https://example.org/enterprise#> .

<https://example.org/enterprise>
  a owl:Ontology ;
  rdfs:label "Enterprise Knowledge Model"@en ;
  rdfs:comment "Domain ontology for enterprise org structure"@en ;
  owl:versionInfo "1.0.0" .

ex:Person a owl:Class ;
  rdfs:label "Person" ;
  rdfs:comment "A human employee or contractor" .

ex:Employee a owl:Class ;
  rdfs:label "Employee" ;
  rdfs:subClassOf ex:Person ;
  rdfs:comment "A permanent employee" .

ex:Department a owl:Class ;
  rdfs:label "Department" ;
  rdfs:comment "An organizational unit" .

ex:fullName a owl:DatatypeProperty ;
  rdfs:domain ex:Person ;
  rdfs:range xsd:string ;
  rdfs:comment "Full name of the person" .

ex:employeeId a owl:DatatypeProperty ;
  rdfs:domain ex:Employee ;
  rdfs:range xsd:string ;
  rdfs:comment "Unique corporate badge ID" .

ex:inDepartment a owl:ObjectProperty ;
  rdfs:domain ex:Employee ;
  rdfs:range ex:Department ;
  rdfs:comment "Department where employee works" .
`

test("LinkML OWL Turtle import parses ontology entities into snapshot and ImportOntology", () => {
  const linkml = loadLinkmlRuntime()
  const importResult = linkml.fromOwl(SAMPLE_OWL_TURTLE)
  assert.ok(importResult.schema, "fromOwl must generate a LinkML schema")

  const snapshot = linkmlYamlToSnapshot("enterprise-ont", importResult.schema)
  assert.ok(snapshot.document, "Snapshot document must exist")
  assert.ok(snapshot.classes.length >= 3, "Must have at least 3 classes")

  const personCls = snapshot.classes.find((c) => c.name === "Person")
  const employeeCls = snapshot.classes.find((c) => c.name === "Employee")
  const deptCls = snapshot.classes.find((c) => c.name === "Department")

  assert.ok(personCls, "Person class must exist in snapshot")
  assert.ok(employeeCls, "Employee class must exist in snapshot")
  assert.ok(deptCls, "Department class must exist in snapshot")
  assert.equal(
    employeeCls.parent_class_id,
    "Person",
    "Employee must inherit from Person"
  )

  // Test parseTurtleToImportOntology with preferLinkml: true
  const importOntology = parseTurtleToImportOntology(SAMPLE_OWL_TURTLE, {
    fileName: "enterprise.ttl",
    preferLinkml: true,
  })

  assert.ok(importOntology.name, "ImportOntology must have a name")
  assert.ok(
    importOntology.classes.length >= 3,
    "ImportOntology must have classes"
  )
  assert.ok(
    importOntology.classes.some((c) => c.name === "Person"),
    "Person class in ImportOntology"
  )
  assert.ok(
    importOntology.classes.some((c) => c.name === "Employee"),
    "Employee class in ImportOntology"
  )
  assert.ok(
    importOntology.classes.some((c) => c.name === "Department"),
    "Department class in ImportOntology"
  )
})

test("LinkML compiler produces multi-format artifacts (SHACL, RDFS, OWL, Pydantic, JSON Schema, ER Diagram)", () => {
  const linkml = loadLinkmlRuntime()
  const importResult = linkml.fromOwl(SAMPLE_OWL_TURTLE)
  const snapshot = linkmlYamlToSnapshot("enterprise-ont", importResult.schema)

  const { linkmlYaml, artifacts } = compileSnapshotArtifacts(snapshot)
  assert.ok(linkmlYaml, "LinkML YAML must be non-empty")
  assert.ok(artifacts.shacl_ttl, "SHACL Turtle must be non-empty")
  assert.ok(artifacts.rdfs_ttl, "RDFS Turtle must be non-empty")
  assert.ok(artifacts.owl_ttl, "OWL Turtle must be non-empty")
  assert.ok(artifacts.pydantic_py, "Pydantic Python code must be non-empty")
  assert.ok(artifacts.json_schema, "JSON Schema must be non-empty")
  assert.ok(artifacts.er_diagram, "ER Diagram must be non-empty")

  // Check SHACL output contains NodeShapes
  assert.ok(artifacts.shacl_ttl.includes("sh:NodeShape"), "SHACL has NodeShape")
  assert.ok(artifacts.shacl_ttl.includes("Person"), "SHACL has Person shape")

  // Check RDFS output contains Class and SubClass
  assert.ok(artifacts.rdfs_ttl.includes("rdfs:Class"), "RDFS has rdfs:Class")
  assert.ok(
    artifacts.rdfs_ttl.includes("rdfs:subClassOf"),
    "RDFS has subClassOf"
  )

  // Check OWL output contains owl:Class
  assert.ok(artifacts.owl_ttl.includes("owl:Class"), "OWL has owl:Class")

  // Check Pydantic output contains BaseModel and Person class
  assert.ok(
    artifacts.pydantic_py.includes("BaseModel"),
    "Pydantic uses BaseModel"
  )
  assert.ok(
    artifacts.pydantic_py.includes("class Person"),
    "Pydantic defines Person"
  )
  assert.ok(
    artifacts.pydantic_py.includes("class Employee"),
    "Pydantic defines Employee"
  )

  // Check JSON Schema is valid JSON
  const parsedJsonSchema = JSON.parse(artifacts.json_schema)
  assert.ok(
    parsedJsonSchema.$schema ||
      parsedJsonSchema.title ||
      parsedJsonSchema.$defs ||
      parsedJsonSchema.definitions,
    "Valid JSON Schema"
  )

  // Check Mermaid ER diagram
  assert.ok(artifacts.er_diagram.includes("erDiagram"), "ER Diagram format")
})

test("buildShaclShapes delegates to @neverblink/linkml view.shacl when preferLinkml is enabled", () => {
  const ontology: ImportOntology = {
    name: "Enterprise",
    defaultLanguage: "en",
    languages: [{ code: "en", label: "English" }],
    usecase: "Testing LinkML SHACL delegation",
    modules: [{ id: "core", name: "Core", description: "Core module" }],
    classes: [
      {
        id: "Employee",
        name: "Employee",
        description: "An employee",
        moduleId: "core",
        attributes: [
          {
            name: "badge_number",
            dataType: "xsd:string",
            required: true,
            description: "Badge number",
          },
        ],
      },
      {
        id: "Department",
        name: "Department",
        description: "A department",
        moduleId: "core",
        attributes: [],
      },
    ],
    relations: [
      {
        id: "assigned_to",
        name: "assigned_to",
        description: "Assigned department",
        domainClassId: "Employee",
        rangeClassId: "Department",
        cardinality: "N:1",
      },
    ],
    relationAttributes: [],
    competencyQuestions: [],
    notes: [],
    examples: [],
    localizedTexts: [],
  }

  const shaclOutput = buildShaclShapes({
    baseIri: "https://example.org/enterprise#",
    ontology,
    preferLinkml: true,
  })

  assert.ok(
    shaclOutput.includes("sh:NodeShape"),
    "Output contains sh:NodeShape"
  )
  assert.ok(shaclOutput.includes("Employee"), "Output targets Employee")
  assert.ok(
    shaclOutput.includes("badge_number") || shaclOutput.includes("badgeNumber"),
    "Output includes badge_number property"
  )
})

test("End-to-end import and export actions integration", async () => {
  // 1. Import Turtle to database
  const importResult = await importOntologyFromTurtleInternal({
    content: SAMPLE_OWL_TURTLE,
    fileName: "e2e-enterprise.ttl",
  })

  assert.ok(importResult.ontologyId, "Must return an imported ontologyId")
  const ontologyId = importResult.ontologyId

  // 2. Test exportOntologyArtifactsAction for each format
  const formats: OntologyArtifactFormat[] = [
    "linkml-yaml",
    "shacl-ttl",
    "rdfs-ttl",
    "owl-ttl",
    "pydantic-py",
    "json-schema",
    "er-diagram",
  ]

  for (const fmt of formats) {
    const res = await exportOntologyArtifactsAction(ontologyId, fmt)
    assert.equal(res.format, fmt)
    assert.ok(res.content, `Format ${fmt} must return non-empty content`)
    assert.ok(res.fileName, `Format ${fmt} must return a fileName`)
    assert.ok(res.mimeType, `Format ${fmt} must return a mimeType`)
    assert.ok(res.sourceSha256, `Format ${fmt} must return sourceSha256`)
  }

  // 3. Test buildOntologyShaclExport action
  const shaclExport = await buildOntologyShaclExport({
    ontologyId,
    baseIri: "https://example.org/enterprise#",
    exportLanguage: "en",
    missingTranslationBehavior: "fallback",
    moduleIds: [],
    classIds: [],
    relationIds: [],
  })
  assert.ok(shaclExport.content, "buildOntologyShaclExport produces content")
  assert.ok(
    shaclExport.fileName.endsWith(".shacl.ttl"),
    "buildOntologyShaclExport fileName ends with .shacl.ttl"
  )

  // 4. Test buildOntologyOwlExport action
  const owlExport = await buildOntologyOwlExport({
    ontologyId,
    baseIri: "https://example.org/enterprise#",
    exportLanguage: "en",
    missingTranslationBehavior: "fallback",
    moduleIds: [],
    classIds: [],
    relationIds: [],
  })
  assert.ok(owlExport.content, "buildOntologyOwlExport produces content")
  assert.ok(
    owlExport.fileName.endsWith(".owl"),
    "buildOntologyOwlExport fileName ends with .owl"
  )
})
