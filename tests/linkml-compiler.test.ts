import assert from "node:assert/strict"
import crypto from "node:crypto"
import { test } from "node:test"
import {
  compileLinkmlOntology,
  compileSnapshotArtifacts,
} from "../src/features/ontology/server/linkml/compiler"
import type { CanonicalOntologySnapshot } from "../src/features/ontology/server/linkml/types"

const SAMPLE_LINKML_YAML = `
id: https://example.org/test-org
name: test_organization_ontology
description: Organization and personnel domain model
in_language: en
prefixes:
  test: https://example.org/test-org/
  linkml: https://w3id.org/linkml/
imports:
  - linkml:types
classes:
  Organization:
    description: A legal or formal entity
    attributes:
      id:
        range: string
        identifier: true
      legal_name:
        range: string
        required: true
  Person:
    description: An individual person
    attributes:
      id:
        range: string
        identifier: true
      full_name:
        range: string
        required: true
      email:
        range: string
        required: false
      age:
        range: integer
        required: false
slots:
  employed_at:
    domain: Person
    range: Organization
    multivalued: false
    description: The organization where a person is employed
`

test("compileLinkmlOntology produces all multi-format artifacts for a valid schema", () => {
  const artifacts = compileLinkmlOntology(SAMPLE_LINKML_YAML)

  // 1. source_sha256 matches crypto sha256
  const expectedHash = crypto
    .createHash("sha256")
    .update(SAMPLE_LINKML_YAML)
    .digest("hex")
  assert.equal(artifacts.source_sha256, expectedHash)

  // 2. compiled_at is an ISO timestamp
  assert.ok(artifacts.compiled_at, "compiled_at must be populated")
  const date = new Date(artifacts.compiled_at)
  assert.equal(
    Number.isNaN(date.getTime()),
    false,
    "compiled_at must be valid date"
  )

  // 3. SHACL Turtle contains sh:NodeShape and property shapes
  assert.ok(
    artifacts.shacl_ttl.includes("sh:NodeShape"),
    "shacl_ttl must contain sh:NodeShape"
  )
  assert.ok(
    artifacts.shacl_ttl.includes("sh:property") ||
      artifacts.shacl_ttl.includes("sh:PropertyShape"),
    "shacl_ttl must contain property shapes"
  )
  assert.ok(
    artifacts.shacl_ttl.includes("sh:path"),
    "shacl_ttl must contain sh:path"
  )

  // 4. RDFS Turtle contains rdfs:Class and rdf:Property
  assert.ok(
    artifacts.rdfs_ttl.includes("rdfs:Class") ||
      artifacts.rdfs_ttl.includes("owl:Class"),
    "rdfs_ttl must declare classes"
  )
  assert.ok(
    artifacts.rdfs_ttl.includes("rdf:Property") ||
      artifacts.rdfs_ttl.includes("rdfs:domain") ||
      artifacts.rdfs_ttl.includes("rdfs:range"),
    "rdfs_ttl must declare properties or domain/range"
  )

  // 5. OWL 2 Turtle contains owl:Class and owl properties
  assert.ok(
    artifacts.owl_ttl.includes("owl:Class"),
    "owl_ttl must contain owl:Class"
  )
  assert.ok(
    artifacts.owl_ttl.includes("owl:ObjectProperty") ||
      artifacts.owl_ttl.includes("owl:DatatypeProperty"),
    "owl_ttl must contain OWL properties"
  )

  // 6. Python Pydantic v2 code contains class definitions and BaseModel
  assert.ok(
    artifacts.pydantic_py.includes("BaseModel"),
    "pydantic_py must reference BaseModel"
  )
  assert.ok(
    artifacts.pydantic_py.includes("class Organization") ||
      artifacts.pydantic_py.includes("class Person"),
    "pydantic_py must define schema classes"
  )

  // 7. JSON Schema parses and contains root definitions
  assert.ok(artifacts.json_schema, "json_schema must not be empty")
  const parsedJsonSchema = JSON.parse(artifacts.json_schema)
  assert.ok(
    parsedJsonSchema.$schema ||
      parsedJsonSchema.$defs ||
      parsedJsonSchema.definitions,
    "json_schema must be valid JSON schema"
  )

  // 8. Mermaid ER diagram contains erDiagram
  assert.ok(
    artifacts.er_diagram.includes("erDiagram"),
    "er_diagram must contain erDiagram header"
  )
  assert.ok(
    artifacts.er_diagram.includes("Organization") ||
      artifacts.er_diagram.includes("Person"),
    "er_diagram must include class entities"
  )

  // 9. lint_issues is an array
  assert.ok(
    Array.isArray(artifacts.lint_issues),
    "lint_issues must be an array"
  )
})

test("compileSnapshotArtifacts compiles from a CanonicalOntologySnapshot", () => {
  const snapshot: CanonicalOntologySnapshot = {
    document: {
      id: "snapshot-test-1",
      name: "Snapshot Test",
      base_iri: "https://example.org/snapshot-test#",
      prefixes: {
        snt: "https://example.org/snapshot-test#",
      },
      imports: ["linkml:types"],
    },
    modules: [
      {
        id: "core",
        name: "Core Domain",
        description: "Core module",
      },
    ],
    classes: [
      {
        id: "Department",
        name: "Department",
        description: "A business department",
        module_id: "core",
        attributes: [
          {
            id: "Department.dept_name",
            class_id: "Department",
            name: "dept_name",
            data_type: "xsd:string",
            required: true,
          },
        ],
      },
      {
        id: "Employee",
        name: "Employee",
        description: "A worker in a department",
        module_id: "core",
        attributes: [
          {
            id: "Employee.emp_id",
            class_id: "Employee",
            name: "emp_id",
            data_type: "xsd:string",
            required: true,
          },
        ],
      },
    ],
    attributes: [],
    relations: [
      {
        id: "in_department",
        name: "in_department",
        domain_class_id: "Employee",
        range_class_id: "Department",
        cardinality: "N:1",
      },
    ],
    relation_attributes: [],
  }

  const result = compileSnapshotArtifacts(snapshot)
  assert.ok(result.linkmlYaml, "linkmlYaml must be returned")
  assert.ok(result.artifacts, "artifacts must be returned")

  assert.equal(
    result.artifacts.source_sha256,
    crypto.createHash("sha256").update(result.linkmlYaml).digest("hex")
  )
  assert.ok(result.artifacts.shacl_ttl.includes("sh:NodeShape"))
  assert.ok(result.artifacts.owl_ttl.includes("Department"))
  assert.ok(result.artifacts.pydantic_py.includes("Department"))
  assert.ok(result.artifacts.er_diagram.includes("erDiagram"))
})

test("compileLinkmlOntology handles cyclic/broken schemas gracefully with structured lint issues", () => {
  const cyclicSchema = `
id: https://example.org/cyclic-schema
name: cyclic_schema
prefixes:
  linkml: https://w3id.org/linkml/
imports:
  - linkml:types
classes:
  A:
    is_a: B
  B:
    is_a: A
`

  const artifacts = compileLinkmlOntology(cyclicSchema)

  // Must not throw, must return artifacts object
  assert.ok(artifacts, "Must return artifacts object")
  assert.equal(
    artifacts.source_sha256,
    crypto.createHash("sha256").update(cyclicSchema).digest("hex")
  )
  assert.ok(Array.isArray(artifacts.lint_issues))
  assert.ok(
    artifacts.lint_issues.length > 0,
    "Must report lint issues for cyclic inheritance"
  )

  const hasFatalOrError = artifacts.lint_issues.some(
    (issue) =>
      issue.severity === "FATAL" ||
      issue.severity === "ERROR" ||
      issue.issue_type === "CyclicReference"
  )
  assert.ok(
    hasFatalOrError,
    "Must contain FATAL, ERROR, or CyclicReference issue"
  )

  // Every issue must have required properties
  for (const issue of artifacts.lint_issues) {
    assert.ok(issue.issue_type, "issue_type must be string")
    assert.ok(issue.severity, "severity must be string")
    assert.ok(issue.message, "message must be string")
  }
})

test("compileLinkmlOntology handles fatal syntax errors without throwing unhandled exceptions", () => {
  const brokenYaml = `::: completely invalid linkml yaml :::`

  const artifacts = compileLinkmlOntology(brokenYaml)
  assert.ok(artifacts, "Must return artifacts object even on fatal errors")
  assert.equal(
    artifacts.source_sha256,
    crypto.createHash("sha256").update(brokenYaml).digest("hex")
  )
  assert.ok(Array.isArray(artifacts.lint_issues))
  assert.ok(artifacts.lint_issues.length > 0)
  assert.equal(artifacts.shacl_ttl, "")
  assert.equal(artifacts.rdfs_ttl, "")
  assert.equal(artifacts.owl_ttl, "")
  assert.equal(artifacts.pydantic_py, "")
  assert.equal(artifacts.json_schema, "")
  assert.equal(artifacts.er_diagram, "")
})

test("compileLinkmlOntology is deterministic for identical input", () => {
  const result1 = compileLinkmlOntology(SAMPLE_LINKML_YAML)
  const result2 = compileLinkmlOntology(SAMPLE_LINKML_YAML)

  assert.equal(result1.source_sha256, result2.source_sha256)
  assert.equal(result1.shacl_ttl, result2.shacl_ttl)
  assert.equal(result1.rdfs_ttl, result2.rdfs_ttl)
  assert.equal(result1.owl_ttl, result2.owl_ttl)
  assert.equal(result1.pydantic_py, result2.pydantic_py)
  assert.equal(result1.json_schema, result2.json_schema)
  assert.equal(result1.er_diagram, result2.er_diagram)
})
