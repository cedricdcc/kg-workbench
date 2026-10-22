import assert from "node:assert/strict"
import { test } from "node:test"
import { runOntologyLinter } from "../src/features/ontology/utils/linter"
import type { OntologyClassWithAttributes } from "../src/features/ontology/server/queries"
import type { OntologyRelation } from "../src/domain/ontology"

function createMockClass(
  id: string,
  name: string,
  parentClassId: string | null = null,
  description = "A valid class description"
): OntologyClassWithAttributes {
  return {
    id,
    name,
    description,
    instance_policy: "open",
    ontology_id: "ont-1",
    parent_class_id: parentClassId,
    module_id: null,
    attributes: [],
  }
}

function createMockRelation(
  id: string,
  name: string,
  domainClassId: string,
  rangeClassId: string,
  inverseName?: string | null,
  description = "A valid relation description"
): OntologyRelation {
  return {
    id,
    name,
    domain_class_id: domainClassId,
    range_class_id: rangeClassId,
    inverse_name: inverseName ?? null,
    description,
    ontology_id: "ont-1",
    cardinality: null,
    instance_policy: "open",
  }
}

test("runOntologyLinter on a clean connected ontology returns 0 defects and hasErrors: false", () => {
  const classes = [
    createMockClass("c-vehicle", "Vehicle", null, "A machine that transports people or cargo"),
    createMockClass("c-car", "Car", "c-vehicle", "A road vehicle with four wheels"),
  ]
  const relations = [
    createMockRelation("r-drives", "drives", "c-car", "c-vehicle", null, "Car is operated on road"),
  ]

  const report = runOntologyLinter({ classes, relations })

  assert.equal(report.hasErrors, false)
  assert.equal(report.hasWarnings, false)
  assert.equal(report.total, 0)
  assert.equal(report.defects.length, 0)
})

test("runOntologyLinter detects direct self-parent cycle (A -> A) with OOPS! P29", () => {
  const classes = [
    createMockClass("c-1", "LoopClass", "c-1"),
  ]
  const report = runOntologyLinter({ classes, relations: [] })

  assert.equal(report.hasErrors, true)
  const cycleDefect = report.defects.find((d) => d.kind === "subclass_cycle")
  assert.ok(cycleDefect, "Should emit subclass_cycle defect")
  assert.equal(cycleDefect.targetId, "c-1")
  assert.equal(cycleDefect.severity, "error")
  assert.equal(cycleDefect.oopsPitfallId, "P29")
})

test("runOntologyLinter detects transitive cycle (A -> B -> C -> A) with OOPS! P29", () => {
  const classes = [
    createMockClass("c-a", "ClassA", "c-c"),
    createMockClass("c-b", "ClassB", "c-a"),
    createMockClass("c-c", "ClassC", "c-b"),
  ]
  const report = runOntologyLinter({ classes, relations: [] })

  assert.equal(report.hasErrors, true)
  const cycleDefects = report.defects.filter((d) => d.kind === "subclass_cycle")
  assert.ok(cycleDefects.length >= 3, "All classes in cycle must be flagged")
  const targetIds = cycleDefects.map((d) => d.targetId)
  assert.ok(targetIds.includes("c-a"))
  assert.ok(targetIds.includes("c-b"))
  assert.ok(targetIds.includes("c-c"))
})

test("runOntologyLinter detects dangling relation domain and range with OOPS! P10", () => {
  const classes = [createMockClass("c-person", "Person")]
  const relations = [
    createMockRelation("r-dangling-range", "owns", "c-person", "non-existent-dog-id"),
    createMockRelation("r-dangling-domain", "livesIn", "non-existent-city-id", "c-person"),
  ]

  const report = runOntologyLinter({ classes, relations })

  assert.equal(report.hasErrors, true)
  const rangeDefect = report.defects.find((d) => d.kind === "dangling_relation_range")
  assert.ok(rangeDefect, "Should emit dangling_relation_range")
  assert.equal(rangeDefect.targetId, "r-dangling-range")
  assert.equal(rangeDefect.oopsPitfallId, "P10")

  const domainDefect = report.defects.find((d) => d.kind === "dangling_relation_domain")
  assert.ok(domainDefect, "Should emit dangling_relation_domain")
  assert.equal(domainDefect.targetId, "r-dangling-domain")
  assert.equal(domainDefect.oopsPitfallId, "P10")
})

test("runOntologyLinter flags orphan disconnected classes with OOPS! P04", () => {
  const classes = [
    createMockClass("c-connected-1", "Device", null),
    createMockClass("c-connected-2", "Sensor", "c-connected-1"),
    createMockClass("c-orphan", "IsolatedConcept", null),
  ]

  const report = runOntologyLinter({ classes, relations: [] })

  const orphanDefect = report.defects.find((d) => d.kind === "orphan_class")
  assert.ok(orphanDefect, "Should emit orphan_class")
  assert.equal(orphanDefect.targetId, "c-orphan")
  assert.equal(orphanDefect.severity, "warning")
  assert.equal(orphanDefect.oopsPitfallId, "P04")
})

test("runOntologyLinter detects near-duplicate class names with OOPS! P24", () => {
  const classes = [
    createMockClass("c-1", "PatientRecord"),
    createMockClass("c-2", "patient_record"),
  ]

  const report = runOntologyLinter({ classes, relations: [] })

  const dupDefects = report.defects.filter((d) => d.kind === "near_duplicate_class")
  assert.equal(dupDefects.length, 2, "Both conflicting classes should be reported")
  assert.equal(dupDefects[0].oopsPitfallId, "P24")
})

test("runOntologyLinter detects near-duplicate relation names with OOPS! P24", () => {
  const classes = [createMockClass("c-1", "Entity")]
  const relations = [
    createMockRelation("r-1", "hasPart", "c-1", "c-1"),
    createMockRelation("r-2", "has_part", "c-1", "c-1"),
  ]

  const report = runOntologyLinter({ classes, relations })

  const dupRelDefects = report.defects.filter((d) => d.kind === "near_duplicate_relation")
  assert.equal(dupRelDefects.length, 2)
  assert.equal(dupRelDefects[0].oopsPitfallId, "P24")
})

test("runOntologyLinter detects competing modeling pattern", () => {
  const classes = [
    createMockClass("c-device", "Device"),
    createMockClass("c-sensor", "Sensor", "c-device"),
    createMockClass("c-actuator", "Actuator", "c-device"),
    createMockClass("c-devicetype", "DeviceType", null), // Competing attribute class
  ]

  const report = runOntologyLinter({ classes, relations: [] })

  const competingDefect = report.defects.find((d) => d.kind === "competing_modelling_pattern")
  assert.ok(competingDefect, "Should flag DeviceType as competing with subclasses of Device")
  assert.equal(competingDefect.targetId, "c-devicetype")
})

test("runOntologyLinter detects inverse relation inconsistency with OOPS! P11", () => {
  const classes = [
    createMockClass("c-person", "Person"),
    createMockClass("c-company", "Company"),
  ]
  const relations = [
    createMockRelation("r-works-for", "worksFor", "c-person", "c-company", "employs"),
    // Missing the corresponding reverse relation 'employs' from Company to Person
  ]

  const report = runOntologyLinter({ classes, relations })

  const inverseDefect = report.defects.find((d) => d.kind === "inverse_inconsistent")
  assert.ok(inverseDefect, "Should detect missing reverse relation")
  assert.equal(inverseDefect.targetId, "r-works-for")
  assert.equal(inverseDefect.oopsPitfallId, "P11")
})

test("runOntologyLinter detects missing descriptions with OOPS! P08", () => {
  const classes = [
    createMockClass("c-node", "Node", null, ""), // empty description
  ]
  const relations = [
    createMockRelation("r-edge", "connects", "c-node", "c-node", null, "   "),
  ]

  const report = runOntologyLinter({ classes, relations })

  const descDefects = report.defects.filter((d) => d.kind === "missing_description")
  assert.equal(descDefects.length, 2)
  assert.equal(descDefects[0].oopsPitfallId, "P08")
})

test("runOntologyLinter excludes suppressed defect IDs from primary count", () => {
  const mockAttr = {
    id: "attr-1",
    class_id: "c-child",
    name: "attr1",
    data_type: "string",
    required: false,
    description: "attr description",
    sort_order: 0,
  }
  const classes = [
    { ...createMockClass("c-root", "RootClass", null), attributes: [mockAttr] },
    { ...createMockClass("c-child", "ChildClass", "c-root"), attributes: [mockAttr] },
    { ...createMockClass("c-orphan", "OrphanClass", null), attributes: [mockAttr] },
  ]
  const suppressedDefectId = "orphan_class:class:c-orphan"
  const report = runOntologyLinter({
    classes,
    relations: [],
    suppressedIds: new Set([suppressedDefectId]),
  })

  assert.equal(report.counts.warning, 0)
  assert.equal(report.total, 0)
  assert.equal(report.suppressed.length, 1)
  assert.equal(report.suppressed[0].id, suppressedDefectId)
})
