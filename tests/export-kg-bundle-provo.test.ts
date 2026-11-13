import assert from "node:assert/strict"
import { test } from "node:test"
import { Parser as N3Parser } from "n3"
import { compileLinkmlOntology } from "../src/features/ontology/server/linkml/compiler"
import type { OhiLockfileV2 } from "../src/features/ontology/server/ohi/types"
import { buildKnowledgeGraphBundle } from "../src/features/documents/server/actions/build-kg-bundle"

const PROV = "http://www.w3.org/ns/prov#"
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
const RDFS = "http://www.w3.org/2000/01/rdf-schema#"
const OHI = "https://ohi.dev/ns#"
const DCTERMS = "http://purl.org/dc/terms/"

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
      age:
        range: integer
        required: false
slots:
  employed_at:
    domain: Person
    range: Organization
    multivalued: false
`

const SAMPLE_LOCKFILE: OhiLockfileV2 = {
  lock_version: 2,
  selections: [
    {
      ontology: "bfo",
      format: "owl-turtle",
    },
    {
      ontology: "prov-o",
      format: "rdfs-turtle",
    },
  ],
  files: [
    {
      package_path: "bfo/bfo.ttl",
      base_url: "https://ohi.dev/packages/bfo/2020/",
      url: "https://ohi.dev/packages/bfo/2020/bfo.ttl",
      format: "owl-turtle",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ontology: "bfo",
    },
    {
      package_path: "prov-o/prov.ttl",
      base_url: "https://ohi.dev/packages/prov-o/1.0/",
      url: "https://ohi.dev/packages/prov-o/1.0/prov.ttl",
      format: "rdfs-turtle",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ontology: "prov-o",
    },
  ],
}

test("buildKnowledgeGraphBundle emits W3C PROV-O provenance, locked OHI packages, and valid multi-format artifacts", () => {
  const compiled = compileLinkmlOntology(SAMPLE_LINKML_YAML)

  const bundle = buildKnowledgeGraphBundle({
    document: {
      id: "doc-123",
      title: "Acme Personnel Report",
    },
    ontology: {
      id: "ont-456",
      name: "test_organization_ontology",
      baseIri: "https://example.org/test-org/",
      ohiLockfile: SAMPLE_LOCKFILE,
    },
    compiledArtifacts: compiled,
    latestRun: {
      id: "run-789",
      ontology_id: "ont-456",
      ontology_sha256: compiled.source_sha256,
      ohi_lockfile_snapshot: SAMPLE_LOCKFILE,
      started_at: "2026-11-13T06:00:00.000Z",
      completed_at: "2026-11-13T06:01:30.000Z",
    },
    entities: [
      {
        id: "ent-1",
        entity_text: "Alice Smith",
        class_id: "Person",
        review_status: "accepted",
      },
      {
        id: "ent-2",
        entity_text: "Acme Corp",
        class_id: "Organization",
        review_status: "accepted",
      },
      {
        id: "ent-pending",
        entity_text: "Pending Entity",
        class_id: "Person",
        review_status: "pending",
      },
    ],
    entityAttributes: [
      {
        entity_id: "ent-1",
        attribute_id: "Person.full_name",
        data_type: "xsd:string",
        value: "Alice Smith",
      },
      {
        entity_id: "ent-1",
        attribute_id: "Person.age",
        data_type: "xsd:integer",
        value: "34",
      },
      {
        entity_id: "ent-2",
        attribute_id: "Organization.legal_name",
        data_type: "xsd:string",
        value: "Acme Corporation",
      },
    ],
    facts: [
      {
        id: "fact-1",
        subject_entity_id: "ent-1",
        subject_text: "Alice Smith",
        relation_type_id: "employed_at",
        relation_text: "employed_at",
        object_entity_id: "ent-2",
        object_text: "Acme Corp",
        review_status: "accepted",
        confidence: 0.95,
        anchor_ids: ["anc-1"],
      },
      {
        id: "fact-rejected",
        subject_entity_id: "ent-1",
        subject_text: "Alice Smith",
        relation_type_id: "employed_at",
        relation_text: "employed_at",
        object_entity_id: "ent-pending",
        object_text: "Pending Entity",
        review_status: "rejected",
        confidence: 0.2,
        anchor_ids: [],
      },
    ],
    evidenceAnchors: [
      {
        id: "anc-1",
        quote_text: "Alice Smith is employed at Acme Corp.",
        page_from: 2,
        page_to: 2,
      },
    ],
  })

  // Stats only count accepted entities/facts and locked packages
  assert.equal(bundle.documentId, "doc-123")
  assert.equal(bundle.documentTitle, "Acme Personnel Report")
  assert.equal(bundle.ontologyId, "ont-456")
  assert.equal(bundle.ontologySha256, compiled.source_sha256)
  assert.equal(bundle.runId, "run-789")
  assert.equal(bundle.stats.entitiesCount, 2)
  assert.equal(bundle.stats.factsCount, 1)
  assert.equal(bundle.stats.lockedPackagesCount, 2)

  // Parse instances_ttl with n3.Parser
  const parser = new N3Parser()
  const quads = parser.parse(bundle.files.instances_ttl)
  assert.ok(quads.length > 0, "instances_ttl must parse into RDF quads")

  // 1. prov:Activity exists for the extraction run
  const activityQuads = quads.filter(
    (q) =>
      q.predicate.value === `${RDF}type` &&
      q.object.value === `${PROV}Activity`
  )
  assert.equal(activityQuads.length, 1, "Expected 1 prov:Activity for the run")
  const runSubject = activityQuads[0].subject.value
  assert.ok(runSubject.includes("run-789"))

  // 2. Every ohi.lock.json file entry is emitted as a prov:Entity with sha256, base_url, url, linked via prov:used
  const usedTargets = new Set(
    quads
      .filter(
        (q) =>
          q.subject.value === runSubject && q.predicate.value === `${PROV}used`
      )
      .map((q) => q.object.value)
  )

  for (const lockedFile of SAMPLE_LOCKFILE.files) {
    const matchingShaQuad = quads.find(
      (q) =>
        q.predicate.value === `${OHI}sha256` &&
        q.object.value === lockedFile.sha256
    )
    assert.ok(
      matchingShaQuad,
      `Expected prov:Entity with ohi:sha256=${lockedFile.sha256}`
    )
    const pkgNode = matchingShaQuad.subject.value
    assert.ok(
      usedTargets.has(pkgNode),
      `Expected run prov:Activity to prov:used ${pkgNode}`
    )
    assert.ok(
      quads.some(
        (q) =>
          q.subject.value === pkgNode &&
          q.predicate.value === `${RDF}type` &&
          q.object.value === `${PROV}Entity`
      ),
      `Expected ${pkgNode} to have rdf:type prov:Entity`
    )
    assert.ok(
      quads.some(
        (q) =>
          q.subject.value === pkgNode &&
          q.predicate.value === `${OHI}baseUrl` &&
          q.object.value === lockedFile.base_url
      ),
      `Expected ${pkgNode} to have ohi:baseUrl=${lockedFile.base_url}`
    )
    assert.ok(
      quads.some(
        (q) =>
          q.subject.value === pkgNode &&
          q.predicate.value === `${OHI}downloadUrl` &&
          q.object.value === lockedFile.url
      ),
      `Expected ${pkgNode} to have ohi:downloadUrl=${lockedFile.url}`
    )
  }

  // 3. prov:wasGeneratedBy links extracted instances to the prov:Activity
  const generatedByQuads = quads.filter(
    (q) =>
      q.predicate.value === `${PROV}wasGeneratedBy` &&
      q.object.value === runSubject
  )
  assert.ok(
    generatedByQuads.length >= 2,
    "Expected extracted entities/facts to link via prov:wasGeneratedBy to the run Activity"
  )

  // 4. Evidence anchor citation & prov:wasDerivedFrom
  assert.ok(
    quads.some(
      (q) =>
        q.predicate.value === `${DCTERMS}bibliographicCitation` &&
        q.object.value === "Alice Smith is employed at Acme Corp."
    ),
    "Expected evidence anchor quote in dcterms:bibliographicCitation"
  )
  assert.ok(
    quads.some((q) => q.predicate.value === `${PROV}wasDerivedFrom`),
    "Expected prov:wasDerivedFrom triple linking to evidence"
  )

  // 5. Accepted entity labels & pending entity excluded
  assert.ok(
    quads.some(
      (q) =>
        q.predicate.value === `${RDFS}label` &&
        q.object.value === "Alice Smith"
    )
  )
  assert.ok(
    !quads.some(
      (q) =>
        q.predicate.value === `${RDFS}label` &&
        q.object.value === "Pending Entity"
    ),
    "Pending entity must not be exported"
  )

  // 6. Validate rdfs_ttl, shacl_ttl, pydantic_py, instances_json, ohi_lock_json
  assert.ok(parser.parse(bundle.files.rdfs_ttl).length > 0, "rdfs_ttl must parse")
  assert.ok(parser.parse(bundle.files.shacl_ttl).length > 0, "shacl_ttl must parse")
  assert.ok(bundle.files.pydantic_py.includes("BaseModel"), "pydantic_py must contain BaseModel")

  const parsedInstances = JSON.parse(bundle.files.instances_json) as {
    ontology_id: string | null
    ontology_sha256: string | null
    entities: Array<Record<string, unknown>>
    facts: Array<Record<string, unknown>>
  }
  assert.equal(parsedInstances.ontology_id, "ont-456")
  assert.equal(parsedInstances.ontology_sha256, compiled.source_sha256)
  assert.equal(parsedInstances.entities.length, 2)
  assert.equal(parsedInstances.facts.length, 1)
  const alice = parsedInstances.entities.find((e) => e.id === "ent-1")
  assert.ok(alice)
  assert.equal(alice.class_key, "Person")
  assert.equal(alice.full_name, "Alice Smith")
  assert.equal(alice.age, 34)

  const parsedLock = JSON.parse(bundle.files.ohi_lock_json) as OhiLockfileV2
  assert.equal(parsedLock.lock_version, 2)
  assert.equal(parsedLock.files.length, 2)
})
