import assert from "node:assert/strict"
import { test } from "node:test"
import {
  linkmlYamlToSnapshot,
  makeAttributeKey,
  makeRelationAttributeKey,
  snapshotToLinkmlYaml,
} from "../src/features/ontology/server/linkml/ast-mapper"
import { loadLinkmlRuntime } from "../src/features/ontology/server/linkml/runtime"
import type {
  CanonicalOntologySnapshot,
  OntologyUiLayout,
} from "../src/features/ontology/server/linkml/types"

test("makeAttributeKey and makeRelationAttributeKey generate deterministic composite keys", () => {
  assert.equal(makeAttributeKey("Person", "email"), "Person.email")
  assert.equal(makeAttributeKey("dcat:Dataset", "title"), "dcat:Dataset.title")
  assert.equal(
    makeRelationAttributeKey("works_for", "since"),
    "works_for.since"
  )
  assert.equal(
    makeRelationAttributeKey("Person__manages__Project", "role"),
    "Person__manages__Project.role"
  )
})

test("empty ontology round-trip produces valid LinkML YAML without errors", () => {
  const emptySnapshot: CanonicalOntologySnapshot = {
    document: {
      id: "empty-doc-123",
      name: "empty_ontology",
      version: "0.1.0",
      default_language: "en",
      usecase: "Empty baseline ontology",
    },
    modules: [],
    classes: [],
    attributes: [],
    relations: [],
    relation_attributes: [],
  }

  const yaml = snapshotToLinkmlYaml(emptySnapshot)
  assert.ok(typeof yaml === "string" && yaml.length > 0)
  assert.ok(
    yaml.includes("id: https://kg-workbench.local/ontology/empty-doc-123#")
  )
  assert.ok(yaml.includes("name: empty_ontology"))
  assert.ok(yaml.includes("linkml:types"))

  // Validate with LinkML parser
  const linkml = loadLinkmlRuntime()
  const result = linkml.loadFromString(yaml, {}, true)
  const fatalOrErrorIssues = result.report.issues.filter(
    (issue) => issue.severity === "FATAL" || issue.severity === "ERROR"
  )
  assert.deepEqual(
    fatalOrErrorIssues,
    [],
    "Empty ontology LinkML YAML must not have fatal/error issues"
  )
  assert.ok(result.view, "SchemaView must be produced")

  // Reverse mapping to snapshot
  const parsedSnapshot = linkmlYamlToSnapshot("empty-doc-123", yaml)
  assert.equal(parsedSnapshot.document.id, "empty-doc-123")
  assert.equal(parsedSnapshot.document.name, "empty_ontology")
  assert.equal(parsedSnapshot.document.version, "0.1.0")
  assert.equal(parsedSnapshot.document.usecase, "Empty baseline ontology")
  assert.deepEqual(parsedSnapshot.modules, [])
  assert.deepEqual(parsedSnapshot.classes, [])
  assert.deepEqual(parsedSnapshot.attributes, [])
  assert.deepEqual(parsedSnapshot.relations, [])
  assert.deepEqual(parsedSnapshot.relation_attributes, [])
})

test("full ontology round-trip preserves all workbench entities, annotations, restrictions, and layouts", () => {
  const layout: OntologyUiLayout = {
    classPositions: {
      core: {
        Person: { x: 100, y: 150 },
        Organization: { x: 400, y: 150 },
      },
      projects: {
        Project: { x: 250, y: 350 },
      },
    },
    moduleLayouts: {
      core: { x: 50, y: 50, width: 600, height: 300 },
      projects: { x: 50, y: 400, width: 400, height: 250 },
    },
  }

  const fullSnapshot: CanonicalOntologySnapshot = {
    document: {
      id: "full-ont-456",
      name: "enterprise_kg",
      version: "1.2.0",
      default_language: "en",
      usecase: "Enterprise Knowledge Graph Domain Model",
      base_iri: "https://example.org/enterprise#",
      prefixes: {
        ex: "https://example.org/enterprise#",
        schema: "http://schema.org/",
      },
      imports: ["linkml:types"],
    },
    modules: [
      {
        id: "core",
        name: "Core Domain",
        description: "Core organizational entities",
      },
      {
        id: "projects",
        name: "Project Management",
        description: "Projects and deliverables",
      },
    ],
    classes: [
      {
        id: "Agent",
        name: "Agent",
        description: "An autonomous agent",
        module_id: "core",
        instance_policy: "strict",
      },
      {
        id: "Person",
        name: "Person",
        description: "A human person",
        module_id: "core",
        parent_class_id: "Agent",
        instance_policy: "lenient",
        disjoint_with: ["Organization"],
        disjoint_with_class_ids: ["Organization"],
      },
      {
        id: "Organization",
        name: "Organization",
        description: "A company, institution or team",
        module_id: "core",
        parent_class_id: "Agent",
        instance_policy: "strict",
        disjoint_with: ["Person"],
        disjoint_with_class_ids: ["Person"],
      },
      {
        id: "Project",
        name: "Project",
        description: "A coordinated initiative",
        module_id: "projects",
      },
    ],
    attributes: [
      {
        id: makeAttributeKey("Person", "fullName"),
        class_id: "Person",
        name: "fullName",
        data_type: "xsd:string",
        required: true,
        description: "Legal full name",
      },
      {
        id: makeAttributeKey("Person", "birthDate"),
        class_id: "Person",
        name: "birthDate",
        data_type: "xsd:date",
        required: false,
        description: "Date of birth",
      },
      {
        id: makeAttributeKey("Person", "age"),
        class_id: "Person",
        name: "age",
        data_type: "xsd:integer",
        required: false,
        description: "Age in years",
      },
      {
        id: makeAttributeKey("Organization", "taxId"),
        class_id: "Organization",
        name: "taxId",
        data_type: "xsd:string",
        required: true,
        description: "Official tax registration identifier",
      },
    ],
    relations: [
      {
        id: "works_for",
        name: "works_for",
        domain_class_id: "Person",
        range_class_id: "Organization",
        description: "Employment relationship",
        inverse_name: "employs",
        cardinality: "1:N",
        instance_policy: "strict",
      },
      // Colliding relation name: "leads" between Person -> Organization
      {
        id: "Person__leads__Organization",
        name: "leads",
        domain_class_id: "Person",
        range_class_id: "Organization",
        description: "Person leads an organization",
        cardinality: "0..1",
      },
      // Colliding relation name: "leads" between Person -> Project
      {
        id: "Person__leads__Project",
        name: "leads",
        domain_class_id: "Person",
        range_class_id: "Project",
        description: "Person leads a project",
        cardinality: "1:N",
      },
      // 1:1 relation
      {
        id: "headquarters",
        name: "headquarters",
        domain_class_id: "Organization",
        range_class_id: "Organization",
        description: "Parent headquarters organization",
        cardinality: "1:1",
      },
      // N:1 relation
      {
        id: "member_of",
        name: "member_of",
        domain_class_id: "Person",
        range_class_id: "Organization",
        description: "Person is a member of an organization",
        cardinality: "N:1",
      },
    ],
    relation_attributes: [
      {
        id: makeRelationAttributeKey("works_for", "since"),
        relation_id: "works_for",
        name: "since",
        data_type: "xsd:date",
        required: false,
        description: "Start date of employment",
        sort_order: 1,
      },
    ],
    restrictions: [
      {
        id: "Person:works_for:min",
        class_id: "Person",
        relation_id: "works_for",
        restriction_type: "min",
        cardinality_value: 1,
      },
      {
        id: "Person:works_for:max",
        class_id: "Person",
        relation_id: "works_for",
        restriction_type: "max",
        cardinality_value: 3,
      },
      {
        id: "Person:fullName:exact",
        class_id: "Person",
        attribute_id: makeAttributeKey("Person", "fullName"),
        restriction_type: "exact",
        cardinality_value: 1,
      },
    ],
    disjointness: [
      {
        class_id: "Person",
        disjoint_class_id: "Organization",
      },
    ],
    notes: [
      {
        target_type: "ontology",
        target_id: "full-ont-456",
        body: "Document architectural note",
        author_name: "Architect",
      },
      {
        target_type: "module",
        target_id: "core",
        body: "Module note for core",
      },
      {
        target_type: "class",
        target_id: "Person",
        body: "Class note for Person",
      },
      {
        target_type: "attribute",
        target_id: makeAttributeKey("Person", "fullName"),
        body: "Attribute note for fullName",
      },
      {
        target_type: "relation",
        target_id: "works_for",
        body: "Relation note for works_for",
      },
      {
        target_type: "relation_attribute",
        target_id: makeRelationAttributeKey("works_for", "since"),
        body: "Relation attribute note for since",
      },
    ],
    localized_texts: [
      {
        target_type: "class",
        target_id: "Person",
        field_name: "name",
        language_code: "nl",
        value: "Persoon",
      },
      {
        target_type: "relation",
        target_id: "works_for",
        field_name: "name",
        language_code: "nl",
        value: "werkt_voor",
      },
    ],
    examples: [
      {
        target_type: "class",
        target_id: "Person",
        value: "Alice Doe",
      },
      {
        target_type: "attribute",
        target_id: makeAttributeKey("Person", "fullName"),
        value: "Alice Jane Doe",
      },
      {
        target_type: "relation",
        target_id: "works_for",
        value: "Alice works for Acme Corp",
      },
    ],
    ui_layout: layout,
  }

  // Convert to LinkML YAML
  const yaml = snapshotToLinkmlYaml(fullSnapshot)
  assert.ok(typeof yaml === "string" && yaml.length > 0)

  // Verify colliding slots disambiguation in YAML
  assert.ok(
    yaml.includes("Person__leads__Organization:"),
    "YAML must include disambiguated slot key Person__leads__Organization"
  )
  assert.ok(
    yaml.includes("Person__leads__Project:"),
    "YAML must include disambiguated slot key Person__leads__Project"
  )

  // Validate LinkML engine cleanly loads the generated YAML
  const linkml = loadLinkmlRuntime()
  const result = linkml.loadFromString(yaml, {}, true)
  const fatalOrErrorIssues = result.report.issues.filter(
    (issue) => issue.severity === "FATAL" || issue.severity === "ERROR"
  )
  assert.deepEqual(
    fatalOrErrorIssues,
    [],
    `Full ontology LinkML YAML must parse without fatal/error issues. Got: ${JSON.stringify(fatalOrErrorIssues)}`
  )
  assert.ok(result.view, "SchemaView must be produced")

  // Verify SchemaView stats
  const stats = result.view.stats()
  assert.equal(stats.elements.classes.count, 4, "Should have 4 classes")
  assert.equal(stats.elements.subsets.count, 2, "Should have 2 subsets")
  assert.equal(
    stats.elements.slots.count,
    6,
    "Should have 6 slots in LinkML (works_for, 2 leads, headquarters, member_of, and inverse employs)"
  )

  // Reverse mapping to snapshot
  const parsed = linkmlYamlToSnapshot("full-ont-456", yaml, layout)
  assert.equal(
    parsed.relations.length,
    5,
    "Snapshot should recover exactly the 5 original relations"
  )

  // Validate document properties
  assert.equal(parsed.document.id, "full-ont-456")
  assert.equal(parsed.document.name, "enterprise_kg")
  assert.equal(parsed.document.version, "1.2.0")
  assert.equal(parsed.document.default_language, "en")
  assert.equal(
    parsed.document.usecase,
    "Enterprise Knowledge Graph Domain Model"
  )
  assert.equal(parsed.document.base_iri, "https://example.org/enterprise#")
  assert.equal(parsed.document.prefixes?.schema, "http://schema.org/")

  // Validate modules and preserved display names
  assert.equal(parsed.modules.length, 2)
  const coreMod = parsed.modules.find((m) => m.id === "core")
  assert.ok(coreMod)
  assert.equal(coreMod.name, "Core Domain")
  assert.equal(coreMod.description, "Core organizational entities")
  const projectsMod = parsed.modules.find((m) => m.id === "projects")
  assert.ok(projectsMod)
  assert.equal(projectsMod.name, "Project Management")

  // Validate classes
  assert.equal(parsed.classes.length, 4)
  const personCls = parsed.classes.find((c) => c.id === "Person")
  assert.ok(personCls)
  assert.equal(personCls.parent_class_id, "Agent")
  assert.equal(personCls.module_id, "core")
  assert.equal(personCls.instance_policy, "lenient")
  assert.ok(personCls.disjoint_with?.includes("Organization"))

  // Validate attributes
  const fullNameAttr = parsed.attributes.find((a) => a.name === "fullName")
  assert.ok(fullNameAttr)
  assert.equal(fullNameAttr.id, "Person.fullName")
  assert.equal(fullNameAttr.class_id, "Person")
  assert.equal(fullNameAttr.required, true)
  assert.equal(fullNameAttr.data_type, "xsd:string")

  const birthDateAttr = parsed.attributes.find((a) => a.name === "birthDate")
  assert.ok(birthDateAttr)
  assert.equal(birthDateAttr.data_type, "xsd:date")

  // Validate relations and cardinalities (1:1, 1:N, N:1, 0..1)
  const worksForRel = parsed.relations.find((r) => r.name === "works_for")
  assert.ok(worksForRel)
  assert.equal(worksForRel.domain_class_id, "Person")
  assert.equal(worksForRel.range_class_id, "Organization")
  assert.equal(worksForRel.inverse_name, "employs")
  assert.equal(worksForRel.cardinality, "1:N")
  assert.equal(worksForRel.instance_policy, "strict")

  const hqRel = parsed.relations.find((r) => r.name === "headquarters")
  assert.ok(hqRel, "1:1 relation headquarters must be preserved")
  assert.equal(hqRel.domain_class_id, "Organization")
  assert.equal(hqRel.range_class_id, "Organization")
  assert.equal(hqRel.cardinality, "1:1")

  const memberOfRel = parsed.relations.find((r) => r.name === "member_of")
  assert.ok(memberOfRel, "N:1 relation member_of must be preserved")
  assert.equal(memberOfRel.domain_class_id, "Person")
  assert.equal(memberOfRel.range_class_id, "Organization")
  assert.equal(memberOfRel.cardinality, "N:1")

  const leadsOrgRel = parsed.relations.find(
    (r) =>
      r.domain_class_id === "Person" &&
      r.range_class_id === "Organization" &&
      r.name === "leads"
  )
  assert.ok(
    leadsOrgRel,
    "Disambiguated relation to Organization must have name 'leads'"
  )
  assert.equal(leadsOrgRel.name, "leads")
  assert.equal(leadsOrgRel.cardinality, "0..1")

  const leadsProjRel = parsed.relations.find(
    (r) =>
      r.domain_class_id === "Person" &&
      r.range_class_id === "Project" &&
      r.name === "leads"
  )
  assert.ok(
    leadsProjRel,
    "Disambiguated relation to Project must have name 'leads'"
  )
  assert.equal(leadsProjRel.name, "leads")
  assert.equal(leadsProjRel.cardinality, "1:N")

  // Validate relation attributes
  const sinceAttr = parsed.relation_attributes.find((ra) => ra.name === "since")
  assert.ok(sinceAttr)
  assert.equal(sinceAttr.id, "works_for.since")
  assert.equal(sinceAttr.data_type, "xsd:date")

  // Validate restrictions
  assert.ok(parsed.restrictions && parsed.restrictions.length >= 3)
  const minRest = parsed.restrictions.find(
    (r) =>
      r.class_id === "Person" &&
      r.relation_id === "works_for" &&
      r.restriction_type === "min"
  )
  assert.ok(minRest)
  assert.equal(minRest.cardinality_value, 1)

  const maxRest = parsed.restrictions.find(
    (r) =>
      r.class_id === "Person" &&
      r.relation_id === "works_for" &&
      r.restriction_type === "max"
  )
  assert.ok(maxRest)
  assert.equal(maxRest.cardinality_value, 3)

  const exactAttrRest = parsed.restrictions.find(
    (r) =>
      r.class_id === "Person" &&
      r.attribute_id === "Person.fullName" &&
      r.restriction_type === "exact"
  )
  assert.ok(
    exactAttrRest,
    "Attribute restriction must be correctly mapped to attribute_id"
  )
  assert.equal(exactAttrRest.cardinality_value, 1)

  // Validate notes
  assert.ok(parsed.notes && parsed.notes.length >= 6)
  assert.ok(
    parsed.notes.some(
      (n) =>
        n.target_type === "ontology" && n.body === "Document architectural note"
    )
  )
  assert.ok(
    parsed.notes.some(
      (n) => n.target_type === "module" && n.target_id === "core"
    )
  )
  assert.ok(
    parsed.notes.some(
      (n) => n.target_type === "class" && n.target_id === "Person"
    )
  )
  assert.ok(
    parsed.notes.some(
      (n) => n.target_type === "attribute" && n.target_id === "Person.fullName"
    )
  )
  assert.ok(
    parsed.notes.some(
      (n) => n.target_type === "relation" && n.target_id === "works_for"
    )
  )
  assert.ok(
    parsed.notes.some(
      (n) =>
        n.target_type === "relation_attribute" &&
        n.target_id === "works_for.since"
    )
  )

  // Validate localized texts
  assert.ok(parsed.localized_texts && parsed.localized_texts.length >= 2)
  assert.ok(
    parsed.localized_texts.some(
      (lt) =>
        lt.target_type === "class" &&
        lt.target_id === "Person" &&
        lt.language_code === "nl" &&
        lt.value === "Persoon"
    )
  )
  assert.ok(
    parsed.localized_texts.some(
      (lt) =>
        lt.target_type === "relation" &&
        lt.target_id === "works_for" &&
        lt.language_code === "nl" &&
        lt.value === "werkt_voor"
    )
  )

  // Validate examples
  assert.ok(parsed.examples && parsed.examples.length >= 3)
  assert.ok(
    parsed.examples.some(
      (ex) =>
        ex.target_type === "class" &&
        ex.target_id === "Person" &&
        ex.value === "Alice Doe"
    )
  )
  assert.ok(
    parsed.examples.some(
      (ex) =>
        ex.target_type === "attribute" && ex.target_id === "Person.fullName"
    )
  )
  assert.ok(
    parsed.examples.some(
      (ex) => ex.target_type === "relation" && ex.target_id === "works_for"
    )
  )

  // Validate UI layout
  assert.deepEqual(parsed.ui_layout, layout)

  // Validate UI layout round-trip from annotation when not passed explicitly as parameter
  const parsedWithoutLayoutParam = linkmlYamlToSnapshot("full-ont-456", yaml)
  assert.deepEqual(
    parsedWithoutLayoutParam.ui_layout,
    layout,
    "UI layout must be recovered from root kg_ui_layout annotation"
  )
})

test("linkmlYamlToSnapshot imports native LinkML YAML schemas without workbench annotations cleanly", () => {
  const nativeYaml = `
id: https://w3id.org/linkml/examples/organization
name: organization_model
description: A clean native LinkML schema without workbench annotations
in_language: en
version: "2.0.0"
prefixes:
  org: https://w3id.org/linkml/examples/organization/
  linkml: https://w3id.org/linkml/
imports:
  - linkml:types
subsets:
  hr:
    description: Human resources subset
classes:
  Employee:
    description: An employee record
    in_subset:
      - hr
    attributes:
      employeeNumber:
        range: integer
        required: true
        description: Unique employee identifier
      email:
        range: string
        required: true
    slots:
      - reports_to
  Manager:
    is_a: Employee
    description: A manager employee
slots:
  reports_to:
    domain: Employee
    range: Manager
    description: Supervision relation
    multivalued: false
    required: true
`

  // Validate it is valid LinkML
  const linkml = loadLinkmlRuntime()
  const result = linkml.loadFromString(nativeYaml, {}, true)
  const fatalOrError = result.report.issues.filter(
    (i) => i.severity === "FATAL" || i.severity === "ERROR"
  )
  assert.deepEqual(fatalOrError, [])

  // Map to workbench snapshot
  const snapshot = linkmlYamlToSnapshot("native-ont-789", nativeYaml)
  assert.equal(snapshot.document.id, "native-ont-789")
  assert.equal(snapshot.document.name, "organization_model")
  assert.equal(snapshot.document.version, "2.0.0")
  assert.equal(
    snapshot.document.usecase,
    "A clean native LinkML schema without workbench annotations"
  )

  // Modules
  assert.equal(snapshot.modules.length, 1)
  assert.equal(snapshot.modules[0].id, "hr")

  // Classes
  assert.equal(snapshot.classes.length, 2)
  const emp = snapshot.classes.find((c) => c.id === "Employee")
  const mgr = snapshot.classes.find((c) => c.id === "Manager")
  assert.ok(emp)
  assert.ok(mgr)
  assert.equal(emp.module_id, "hr")
  assert.equal(mgr.parent_class_id, "Employee")

  // Attributes
  assert.equal(snapshot.attributes.length, 2)
  const empNum = snapshot.attributes.find((a) => a.name === "employeeNumber")
  assert.ok(empNum)
  assert.equal(empNum.id, "Employee.employeeNumber")
  assert.equal(empNum.data_type, "integer")
  assert.equal(empNum.required, true)

  // Relations & derived cardinality
  assert.equal(snapshot.relations.length, 1)
  const rel = snapshot.relations[0]
  assert.equal(rel.name, "reports_to")
  assert.equal(rel.domain_class_id, "Employee")
  assert.equal(rel.range_class_id, "Manager")
  assert.equal(rel.cardinality, "1:1") // multivalued: false & required: true
})
