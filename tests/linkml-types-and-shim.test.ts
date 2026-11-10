import assert from "node:assert/strict"
import { test } from "node:test"
import { loadLinkmlRuntime } from "../src/features/ontology/server/linkml/runtime"
import type {
  CanonicalOntologySnapshot,
  CompiledOntologyArtifacts,
  LinkmlLintIssue,
  OntologyUiLayout,
} from "../src/features/ontology/server/linkml/types"

test("loadLinkmlRuntime initializes and exposes buildInfo metadata", () => {
  const linkml = loadLinkmlRuntime()
  assert.ok(linkml, "linkml runtime must be defined")
  assert.equal(typeof linkml.buildInfo, "function")

  const info = linkml.buildInfo()
  assert.ok(info, "buildInfo must return an object")
  assert.equal(info.linkml_scala_version, "0.18.2")
  assert.ok(info.metamodel_version, "metamodel_version must be defined")
  assert.ok(info.platform, "platform must be defined")
})

test("loadLinkmlRuntime parses a minimal LinkML schema successfully", () => {
  const linkml = loadLinkmlRuntime()
  const minimalSchema = `
id: https://example.org/test-schema
name: test_schema
description: Minimal test schema for LinkML runtime
in_language: en
prefixes:
  test: https://example.org/test-schema/
  linkml: https://w3id.org/linkml/
imports:
  - linkml:types
classes:
  Person:
    description: A person entity
    attributes:
      name:
        range: string
        required: true
`

  const result = linkml.loadFromString(minimalSchema, {}, true)
  assert.ok(result, "loadFromString must return a result")
  assert.ok(result.view, "SchemaView must be produced for valid schema")
  assert.ok(
    Array.isArray(result.report.issues),
    "report.issues must be an array"
  )

  const stats = result.view.stats()
  assert.ok(stats, "stats() must return schema statistics")
})

test("loadLinkmlRuntime ensures global process.cwd guard functions", () => {
  const linkml = loadLinkmlRuntime()
  assert.ok(linkml)
  assert.equal(typeof globalThis.process?.cwd, "function")
  assert.ok(typeof globalThis.process.cwd() === "string")
})

test("canonical types allow strongly typed ontology snapshot and compiled artifacts", () => {
  const uiLayout: OntologyUiLayout = {
    classPositions: {
      mod1: {
        cls1: { x: 100, y: 200 },
      },
    },
    moduleLayouts: {
      mod1: { x: 50, y: 50, width: 400, height: 300 },
    },
  }

  const snapshot: CanonicalOntologySnapshot = {
    document: {
      id: "onto-1",
      name: "Test Ontology",
      version: "1.0.0",
      default_language: "en",
      usecase: "Testing canonical types",
      base_iri: "https://example.org/onto/",
      prefixes: {
        ex: "https://example.org/onto/",
      },
    },
    modules: [
      {
        id: "mod1",
        name: "Core",
        description: "Core module",
      },
    ],
    classes: [
      {
        id: "Person",
        name: "Person",
        description: "A human being",
        module_id: "mod1",
        parent_class_id: null,
        instance_policy: "open",
        disjoint_with: ["Organization"],
      },
      {
        id: "Organization",
        name: "Organization",
        description: "An organization",
        module_id: "mod1",
        parent_class_id: null,
        instance_policy: "open",
      },
    ],
    attributes: [
      {
        id: "Person.email",
        class_id: "Person",
        name: "email",
        data_type: "xsd:string",
        required: true,
        description: "Email address",
      },
    ],
    relations: [
      {
        id: "member_of",
        name: "member_of",
        domain_class_id: "Person",
        range_class_id: "Organization",
        description: "Person membership in org",
        cardinality: "many_to_one",
      },
    ],
    relation_attributes: [
      {
        id: "member_of.role",
        relation_id: "member_of",
        name: "role",
        data_type: "xsd:string",
        required: false,
        description: "Membership role",
      },
    ],
    restrictions: [
      {
        class_id: "Person",
        relation_id: "member_of",
        restriction_type: "min_cardinality",
        cardinality_value: 1,
      },
    ],
    notes: [
      {
        target_type: "class",
        target_id: "Person",
        body: "Sample note",
        author_name: "Architect",
      },
    ],
    examples: [
      {
        target_type: "class",
        target_id: "Person",
        value: "Alice",
      },
    ],
    localized_texts: [
      {
        target_type: "class",
        target_id: "Person",
        field_name: "name",
        language_code: "fr",
        value: "Personne",
      },
    ],
    ui_layout: uiLayout,
  }

  const lintIssue: LinkmlLintIssue = {
    issue_type: "CyclicReference",
    severity: "FATAL",
    message: "Cycle detected",
    element: "Person",
  }

  const compiledArtifacts: CompiledOntologyArtifacts = {
    source_sha256:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    compiled_at: "2026-11-10T12:00:00Z",
    shacl_ttl: "@prefix sh: <http://www.w3.org/ns/shacl#> .",
    rdfs_ttl: "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    owl_ttl: "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    pydantic_py: "class Person(BaseModel): pass",
    json_schema: '{"$schema": "https://json-schema.org/draft/2020-12/schema"}',
    er_diagram: "erDiagram\n  Person ||--o{ Organization : member_of",
    lint_issues: [lintIssue],
  }

  assert.equal(snapshot.document.id, "onto-1")
  assert.equal(snapshot.classes.length, 2)
  assert.equal(snapshot.attributes.length, 1)
  assert.equal(snapshot.relations.length, 1)
  assert.equal(snapshot.relation_attributes.length, 1)
  assert.equal(snapshot.ui_layout?.moduleLayouts.mod1.width, 400)
  assert.equal(compiledArtifacts.lint_issues.length, 1)
  assert.equal(compiledArtifacts.lint_issues[0].issue_type, "CyclicReference")
})
