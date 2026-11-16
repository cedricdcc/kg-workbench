import assert from "node:assert/strict"
import crypto from "node:crypto"
import { test } from "node:test"
import {
  extractArtifactsFromOntologyRow,
  resolveExtractionOntologyArtifacts,
} from "../src/features/documents/server/actions/build-extraction-artifacts"
import { buildExtractionEventPayload } from "../src/features/documents/server/actions/enqueue-extraction-job"
import {
  buildOntologySymbolLookup,
  resolveAttributeId,
  resolveClassId,
  resolveRelationId,
  resolveSymbolIds,
} from "../src/features/documents/server/actions/extraction-results-persistence"
import type { CanonicalOntologySnapshot } from "../src/features/ontology/server/linkml/types"

const SAMPLE_LINKML_YAML = `id: https://example.org/test-ontology
name: test_ontology
prefixes:
  linkml: https://w3id.org/linkml/
  ex: https://example.org/test-ontology/
default_prefix: ex
imports:
  - linkml:types
classes:
  Person:
    description: A human person
    attributes:
      name:
        range: string
        required: true
      age:
        range: integer
  Organization:
    description: A company or institution
    attributes:
      title:
        range: string
slots:
  works_for:
    domain: Person
    range: Organization
    description: Employment relationship
`

test("extractArtifactsFromOntologyRow returns null when linkml_yaml is empty", () => {
  assert.equal(
    extractArtifactsFromOntologyRow({
      linkml_yaml: "",
      compiled_artifacts: null,
      ohi_lockfile: null,
    }),
    null
  )
  assert.equal(
    extractArtifactsFromOntologyRow({
      linkml_yaml: "   \n  ",
      compiled_artifacts: null,
      ohi_lockfile: null,
    }),
    null
  )
})

test("extractArtifactsFromOntologyRow compiles linkml_yaml when compiled_artifacts is absent", () => {
  const lockfile = {
    lockfile_version: 2,
    selections: [{ ontology: "foaf", format: "owl-turtle" as const }],
    files: {},
  }
  const expectedSha = crypto
    .createHash("sha256")
    .update(SAMPLE_LINKML_YAML)
    .digest("hex")

  const artifacts = extractArtifactsFromOntologyRow({
    linkml_yaml: SAMPLE_LINKML_YAML,
    compiled_artifacts: null,
    ohi_lockfile: lockfile as unknown as Record<string, unknown>,
  })

  assert.ok(artifacts)
  assert.equal(artifacts.linkml_yaml, SAMPLE_LINKML_YAML)
  assert.equal(artifacts.ontology_sha256, expectedSha)
  assert.deepEqual(artifacts.ohi_lockfile, lockfile)
  assert.ok(
    artifacts.pydantic_code && artifacts.pydantic_code.includes("class Person"),
    "Expected compiled pydantic_code to define Person"
  )
  assert.ok(
    artifacts.json_schema && artifacts.json_schema.includes("Person"),
    "Expected compiled json_schema to include Person"
  )
  assert.ok(
    artifacts.shacl_ttl && artifacts.shacl_ttl.includes("Person"),
    "Expected compiled shacl_ttl to include Person"
  )
  assert.ok(
    artifacts.rdfs_ttl && artifacts.rdfs_ttl.includes("Person"),
    "Expected compiled rdfs_ttl to include Person"
  )
})

test("extractArtifactsFromOntologyRow reuses matching compiled_artifacts without recompiling", () => {
  const expectedSha = crypto
    .createHash("sha256")
    .update(SAMPLE_LINKML_YAML)
    .digest("hex")

  const artifacts = extractArtifactsFromOntologyRow({
    linkml_yaml: SAMPLE_LINKML_YAML,
    compiled_artifacts: {
      source_sha256: expectedSha,
      compiled_at: "2026-11-13T00:00:00Z",
      shacl_ttl: "# cached shacl",
      rdfs_ttl: "# cached rdfs",
      owl_ttl: "# cached owl",
      pydantic_py: "# cached pydantic",
      json_schema: '{"cached":true}',
      er_diagram: "erDiagram",
      lint_issues: [],
    },
    ohi_lockfile: null,
  })

  assert.ok(artifacts)
  assert.equal(artifacts.pydantic_code, "# cached pydantic")
  assert.equal(artifacts.json_schema, '{"cached":true}')
  assert.equal(artifacts.shacl_ttl, "# cached shacl")
  assert.equal(artifacts.rdfs_ttl, "# cached rdfs")
  assert.equal(artifacts.ontology_sha256, expectedSha)
  assert.equal(artifacts.ohi_lockfile, null)
})

test("resolveExtractionOntologyArtifacts loads ontology row from db and returns artifacts", async () => {
  const mockDb = {
    select: () => ({
      from: () => ({
        where: async () => [
          {
            linkml_yaml: SAMPLE_LINKML_YAML,
            compiled_artifacts: null,
            ohi_lockfile: null,
          },
        ],
      }),
    }),
  }

  const artifacts = await resolveExtractionOntologyArtifacts(
    "onto-1",
    mockDb as unknown as Parameters<typeof resolveExtractionOntologyArtifacts>[1]
  )
  assert.ok(artifacts)
  assert.equal(artifacts.linkml_yaml, SAMPLE_LINKML_YAML)
  assert.ok(artifacts.pydantic_code?.includes("class Person"))
})

test("buildExtractionEventPayload includes LinkML artifacts when provided and preserves backward compatibility when omitted", () => {
  const withoutArtifacts = buildExtractionEventPayload("doc-1", "onto-1", {
    provider: "ollama",
    model: "llama3",
  })

  assert.equal(withoutArtifacts.eventType, "extraction.requested")
  assert.equal("linkml_yaml" in withoutArtifacts.payload, false)
  assert.equal("pydantic_code" in withoutArtifacts.payload, false)

  const withArtifacts = buildExtractionEventPayload("doc-1", "onto-1", {
    provider: "ollama",
    model: "llama3",
    artifacts: {
      linkml_yaml: "id: test",
      pydantic_code: "class Person(BaseModel): pass",
      json_schema: "{}",
      shacl_ttl: "@prefix sh: <http://www.w3.org/ns/shacl#> .",
      rdfs_ttl: "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
      ohi_lockfile: { lockfile_version: 2 },
      ontology_sha256: "abc123",
    },
  })

  assert.equal(withArtifacts.payload.linkml_yaml, "id: test")
  assert.equal(
    withArtifacts.payload.pydantic_code,
    "class Person(BaseModel): pass"
  )
  assert.equal(withArtifacts.payload.json_schema, "{}")
  assert.equal(
    withArtifacts.payload.shacl_ttl,
    "@prefix sh: <http://www.w3.org/ns/shacl#> ."
  )
  assert.equal(
    withArtifacts.payload.rdfs_ttl,
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> ."
  )
  assert.deepEqual(withArtifacts.payload.ohi_lockfile, { lockfile_version: 2 })
  assert.equal(withArtifacts.payload.ontology_sha256, "abc123")
})

test("ontology symbol lookup resolves exact and case-insensitive LinkML class, relation, and attribute keys", () => {
  const snapshot: CanonicalOntologySnapshot = {
    document: {
      id: "onto-1",
      name: "Test",
    },
    modules: [],
    classes: [
      { id: "cls-person", name: "Person" },
      { id: "cls-org", name: "Organization" },
    ],
    attributes: [
      { id: "attr-age", class_id: "cls-person", name: "age" },
      { id: "attr-name", class_id: "cls-person", name: "full_name" },
    ],
    relations: [
      {
        id: "rel-works-for",
        name: "works_for",
        domain_class_id: "cls-person",
        range_class_id: "cls-org",
      },
    ],
    relation_attributes: [],
    restrictions: [],
    disjointness: [],
    notes: [],
    examples: [],
    localized_texts: [],
    ui_layout: { classPositions: {}, moduleLayouts: {} },
  }

  const lookup = buildOntologySymbolLookup(snapshot)

  assert.equal(resolveClassId(lookup, "Person"), "cls-person")
  assert.equal(resolveClassId(lookup, "person"), "cls-person")
  assert.equal(resolveClassId(lookup, "  ORGANIZATION "), "cls-org")
  assert.equal(resolveClassId(lookup, "Unknown"), null)

  assert.equal(resolveRelationId(lookup, "works_for"), "rel-works-for")
  assert.equal(resolveRelationId(lookup, "WORKS_FOR"), "rel-works-for")
  assert.equal(resolveRelationId(lookup, "unknown_rel"), null)

  assert.equal(resolveAttributeId(lookup, "cls-person", "age"), "attr-age")
  assert.equal(
    resolveAttributeId(lookup, "cls-person", "Person.age"),
    "attr-age"
  )
  assert.equal(
    resolveAttributeId(lookup, "cls-person", "person.AGE"),
    "attr-age"
  )
  assert.equal(
    resolveAttributeId(lookup, "cls-person", "Person.full_name"),
    "attr-name"
  )
  assert.equal(
    resolveAttributeId(lookup, "cls-org", "Person.age"),
    null,
    "Attribute belonging to Person should not resolve for Organization"
  )

  const combined = resolveSymbolIds(lookup, {
    classKey: "Person",
    relationKey: "WORKS_FOR",
    attributeKey: "Person.age",
  })
  assert.deepEqual(combined, {
    classId: "cls-person",
    relationId: "rel-works-for",
    attributeId: "attr-age",
  })
})
