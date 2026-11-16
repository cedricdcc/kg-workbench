import assert from "node:assert/strict"
import { test } from "node:test"
import type { OntologyRelation } from "../src/domain/ontology"
import type { LinkmlLintIssue } from "../src/features/ontology/server/linkml/types"
import type { OhiLockVerificationReport } from "../src/features/ontology/server/ohi/lockfile-verifier"
import type { OntologyClassWithAttributes } from "../src/features/ontology/server/queries"
import {
  mapLinkmlLintIssuesToDefects,
  mapOhiLockfileDriftToDefects,
  runOntologyLinter,
} from "../src/features/ontology/utils/linter"

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
  description = "A valid relation description"
): OntologyRelation {
  return {
    id,
    name,
    domain_class_id: domainClassId,
    range_class_id: rangeClassId,
    inverse_name: null,
    description,
    ontology_id: "ont-1",
    cardinality: null,
    instance_policy: "open",
  }
}

test("mapLinkmlLintIssuesToDefects maps severities and resolves class, relation, and ontology fallback targets", () => {
  const classes = [{ id: "cls-1", name: "Sensor" }]
  const relations = [{ id: "rel-1", name: "observes" }]

  const issues: LinkmlLintIssue[] = [
    {
      issue_type: "SchemaSyntaxError",
      severity: "FATAL",
      message: "Invalid YAML root",
    },
    {
      issue_type: "ClassValidationError",
      severity: "ERROR",
      message: "Missing slot range on Sensor",
      element: "sensor",
    },
    {
      issue_type: "SlotNamingWarning",
      severity: "WARNING",
      message: "Slot observes should use snake_case",
      element: "OBSERVES",
    },
    {
      issue_type: "MetadataInfo",
      severity: "INFO",
      message: "Consider adding prefixes",
      element: "prefixes",
    },
  ]

  const defects = mapLinkmlLintIssuesToDefects(issues, classes, relations)

  assert.equal(defects.length, 4)

  assert.equal(defects[0].id, "linkml:SchemaSyntaxError:schema:0")
  assert.equal(defects[0].kind, "linkml_lint_issue")
  assert.equal(defects[0].severity, "error")
  assert.equal(defects[0].targetType, "ontology")
  assert.equal(defects[0].targetId, "ontology")
  assert.equal(defects[0].targetName, "LinkML Schema")
  assert.equal(defects[0].source, "linkml")

  assert.equal(defects[1].id, "linkml:ClassValidationError:sensor:1")
  assert.equal(defects[1].severity, "error")
  assert.equal(defects[1].targetType, "class")
  assert.equal(defects[1].targetId, "cls-1")
  assert.equal(defects[1].targetName, "Sensor")
  assert.equal(defects[1].element, "sensor")

  assert.equal(defects[2].id, "linkml:SlotNamingWarning:OBSERVES:2")
  assert.equal(defects[2].severity, "warning")
  assert.equal(defects[2].targetType, "relation")
  assert.equal(defects[2].targetId, "rel-1")
  assert.equal(defects[2].targetName, "observes")

  assert.equal(defects[3].id, "linkml:MetadataInfo:prefixes:3")
  assert.equal(defects[3].severity, "info")
  assert.equal(defects[3].targetType, "ontology")
  assert.equal(defects[3].targetId, "ontology")
  assert.equal(defects[3].targetName, "prefixes")
})

test("mapOhiLockfileDriftToDefects returns empty array when report is null, undefined, or valid", () => {
  assert.deepEqual(mapOhiLockfileDriftToDefects(null), [])
  assert.deepEqual(mapOhiLockfileDriftToDefects(undefined), [])
  assert.deepEqual(
    mapOhiLockfileDriftToDefects({
      valid: true,
      checked_files_count: 2,
      mismatched_files: [],
    }),
    []
  )
})

test("mapOhiLockfileDriftToDefects maps tampered and missing mismatches to ohi_sync quick-fix defects", () => {
  const report: OhiLockVerificationReport = {
    valid: false,
    checked_files_count: 2,
    mismatched_files: [
      {
        path: ".ohi/sosa/sosa.ttl",
        expected_sha256: "aaaa1111222233334444555566667777",
        actual_sha256: "bbbb9999888877776666555544443333",
        reason: "tampered",
        ontology: "w3c/sosa@1.0.0",
      },
      {
        path: ".ohi/foaf/foaf.rdf",
        expected_sha256: "cccc1111222233334444555566667777",
        reason: "missing",
      },
    ],
  }

  const defects = mapOhiLockfileDriftToDefects(report)

  assert.equal(defects.length, 2)

  const tampered = defects[0]
  assert.equal(tampered.id, "ohi-drift:.ohi/sosa/sosa.ttl")
  assert.equal(tampered.kind, "ohi_lockfile_drift")
  assert.equal(tampered.severity, "warning")
  assert.equal(tampered.targetType, "ontology")
  assert.equal(tampered.targetId, ".ohi/sosa/sosa.ttl")
  assert.equal(tampered.targetName, "w3c/sosa@1.0.0")
  assert.equal(tampered.title, "ohi.lock.json SHA-256 Drift Detected")
  assert.equal(tampered.suggestedAction, "Sync Lockfile (ohi sync)")
  assert.equal(tampered.quickFixType, "ohi_sync")
  assert.equal(tampered.source, "ohi")
  assert.ok(tampered.description.includes(".ohi/sosa/sosa.ttl"))
  assert.ok(tampered.description.includes("tampered"))
  assert.ok(tampered.description.includes("aaaa11112222"))
  assert.ok(tampered.description.includes("bbbb99998888"))

  const missing = defects[1]
  assert.equal(missing.id, "ohi-drift:.ohi/foaf/foaf.rdf")
  assert.equal(missing.kind, "ohi_lockfile_drift")
  assert.equal(missing.severity, "warning")
  assert.equal(missing.targetType, "ontology")
  assert.equal(missing.targetId, ".ohi/foaf/foaf.rdf")
  assert.equal(missing.targetName, ".ohi/foaf/foaf.rdf")
  assert.equal(missing.title, "Missing Locked ohi Artifact")
  assert.equal(missing.quickFixType, "ohi_sync")
  assert.ok(missing.description.includes("missing"))
  assert.ok(missing.description.includes("cccc11112222"))
})

test("runOntologyLinter combines structural, LinkML lint, and ohi drift defects with suppression support", () => {
  const classes = [
    createMockClass("c-a", "ClassA", "c-b"),
    createMockClass("c-b", "ClassB", "c-a"),
  ]
  const relations = [
    createMockRelation("r-1", "linksTo", "c-a", "c-b"),
  ]
  const linkmlLintIssues: LinkmlLintIssue[] = [
    {
      issue_type: "SlotWarning",
      severity: "WARNING",
      message: "Slot naming convention warning",
      element: "linksTo",
    },
  ]
  const ohiLockVerification: OhiLockVerificationReport = {
    valid: false,
    checked_files_count: 1,
    mismatched_files: [
      {
        path: ".ohi/sosa/sosa.ttl",
        expected_sha256: "deadbeef12345678",
        reason: "missing",
        ontology: "w3c/sosa@1.0.0",
      },
    ],
  }

  const fullReport = runOntologyLinter({
    classes,
    relations,
    linkmlLintIssues,
    ohiLockVerification,
  })

  assert.equal(fullReport.hasErrors, true)
  assert.equal(fullReport.hasWarnings, true)
  assert.ok(
    fullReport.defects.some((d) => d.kind === "subclass_cycle"),
    "Should include structural defects"
  )
  assert.ok(
    fullReport.defects.some((d) => d.kind === "linkml_lint_issue"),
    "Should include LinkML lint issues"
  )
  assert.ok(
    fullReport.defects.some((d) => d.kind === "ohi_lockfile_drift"),
    "Should include ohi lockfile drift defects"
  )
  assert.equal(fullReport.counts.warning, 2)

  // Verify suppression works on LinkML and ohi drift defects
  const suppressedReport = runOntologyLinter({
    classes,
    relations,
    linkmlLintIssues,
    ohiLockVerification,
    suppressedIds: new Set([
      "linkml:SlotWarning:linksTo:0",
      "ohi-drift:.ohi/sosa/sosa.ttl",
    ]),
  })

  assert.equal(suppressedReport.counts.warning, 0)
  assert.equal(suppressedReport.suppressed.length, 2)
  assert.equal(suppressedReport.hasWarnings, false)
})
