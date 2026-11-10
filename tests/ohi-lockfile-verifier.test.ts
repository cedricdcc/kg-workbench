import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertOhiLockfileIntegrity,
  OhiLockfileDriftError,
  verifyOhiLockfileArtifacts,
  type OhiLockVerificationMismatch,
  type OhiLockVerificationReport,
} from "../src/features/ontology/server/ohi/lockfile-verifier"
import { buildLinkmlImportsFromOhi } from "../src/features/ontology/server/ohi/import-map"
import { resolveOhiDependencyTree } from "../src/features/ontology/server/ohi/catalog-client"
import { computeSha256 } from "../src/features/ontology/server/ohi/manifest"
import { compileLinkmlOntology } from "../src/features/ontology/server/linkml/compiler"

describe("verifyOhiLockfileArtifacts & assertOhiLockfileIntegrity", async () => {
  // Resolve genuine locked files and artifacts using offline catalog
  const { lockfile, artifacts } = await resolveOhiDependencyTree(
    {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [
        { ontology: "w3c/prov-o@2013", format: "linkml-yaml" },
        { ontology: "w3c/dcat@3", format: "owl-turtle" },
      ],
    },
    { offlineOnly: true }
  )

  it("returns valid report when all SHA-256 digests match stored artifacts (Map)", () => {
    const report: OhiLockVerificationReport = verifyOhiLockfileArtifacts(
      lockfile,
      artifacts
    )

    assert.equal(report.valid, true)
    assert.deepEqual(report.mismatched_files, [])
    assert.equal(report.checked_files_count, lockfile.files.length)
    assert.ok(report.checked_files_count >= 2)
  })

  it("returns valid report when stored artifacts are passed as Record<string, string>", () => {
    const artifactsRecord: Record<string, string> = Object.fromEntries(
      artifacts.entries()
    )

    const report = verifyOhiLockfileArtifacts(lockfile, artifactsRecord)

    assert.equal(report.valid, true)
    assert.deepEqual(report.mismatched_files, [])
    assert.equal(report.checked_files_count, lockfile.files.length)
  })

  it("flags reason: 'tampered' when a cached artifact is altered by even a single character", () => {
    const tamperedArtifacts = new Map<string, string>(artifacts)
    const targetFile = lockfile.files[0]
    const originalContent = artifacts.get(targetFile.package_path)!

    // Modify content by appending a comment
    const tamperedContent = originalContent + "\n# tampered by 1 char"
    tamperedArtifacts.set(targetFile.package_path, tamperedContent)
    if (targetFile.path) {
      tamperedArtifacts.set(targetFile.path, tamperedContent)
    }
    if (targetFile.url) {
      tamperedArtifacts.set(targetFile.url, tamperedContent)
    }

    const report = verifyOhiLockfileArtifacts(lockfile, tamperedArtifacts)

    assert.equal(report.valid, false)
    assert.equal(report.mismatched_files.length, 1)

    const mismatch: OhiLockVerificationMismatch = report.mismatched_files[0]
    assert.equal(mismatch.reason, "tampered")
    assert.equal(mismatch.path, targetFile.package_path)
    assert.equal(mismatch.expected_sha256, targetFile.sha256)
    assert.equal(mismatch.actual_sha256, computeSha256(tamperedContent))
    assert.notEqual(mismatch.expected_sha256, mismatch.actual_sha256)
  })

  it("flags reason: 'missing' when a locked file is absent from stored artifacts", () => {
    const missingArtifacts = new Map<string, string>(artifacts)
    const targetFile = lockfile.files[0]

    missingArtifacts.delete(targetFile.package_path)
    if (targetFile.path) {
      missingArtifacts.delete(targetFile.path)
    }
    if (targetFile.url) {
      missingArtifacts.delete(targetFile.url)
    }

    const report = verifyOhiLockfileArtifacts(lockfile, missingArtifacts)

    assert.equal(report.valid, false)
    assert.equal(report.mismatched_files.length, 1)

    const mismatch = report.mismatched_files[0]
    assert.equal(mismatch.reason, "missing")
    assert.equal(mismatch.path, targetFile.package_path)
    assert.equal(mismatch.expected_sha256, targetFile.sha256)
    assert.equal(mismatch.actual_sha256, undefined)
  })

  it("assertOhiLockfileIntegrity passes cleanly on valid artifacts", () => {
    assert.doesNotThrow(() => {
      assertOhiLockfileIntegrity(lockfile, artifacts)
    })
  })

  it("assertOhiLockfileIntegrity throws typed OhiLockfileDriftError on tampered or missing artifacts", () => {
    const tamperedArtifacts = new Map<string, string>(artifacts)
    const targetFile = lockfile.files[0]
    tamperedArtifacts.set(targetFile.package_path, "corrupted content")
    if (targetFile.path) {
      tamperedArtifacts.set(targetFile.path, "corrupted content")
    }
    if (targetFile.url) {
      tamperedArtifacts.set(targetFile.url, "corrupted content")
    }

    assert.throws(
      () => assertOhiLockfileIntegrity(lockfile, tamperedArtifacts),
      (err: unknown) => {
        assert.ok(err instanceof OhiLockfileDriftError)
        assert.equal(err.name, "OhiLockfileDriftError")
        assert.ok(err.report)
        assert.equal(err.report.valid, false)
        assert.equal(err.report.mismatched_files.length, 1)
        assert.equal(err.report.mismatched_files[0].reason, "tampered")
        return true
      }
    )
  })
})

describe("buildLinkmlImportsFromOhi", async () => {
  const { lockfile, artifacts } = await resolveOhiDependencyTree(
    {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [
        { ontology: "w3c/prov-o@2013", format: "linkml-yaml" },
        { ontology: "w3c/dcat@3", format: "owl-turtle" },
      ],
    },
    { offlineOnly: true }
  )

  it("builds imports and importMap mapping canonical ID, package paths, package names, and filenames", () => {
    const { imports, importMap } = buildLinkmlImportsFromOhi(
      lockfile,
      artifacts
    )

    assert.ok(imports && typeof imports === "object")
    assert.ok(importMap && typeof importMap === "object")

    // Canonical schema ID mapping
    assert.ok(
      importMap["http://www.w3.org/ns/prov"],
      "canonical schema ID mapped"
    )
    assert.ok(
      imports["http://www.w3.org/ns/prov"],
      "canonical schema ID in imports"
    )

    // Package ref mappings
    assert.ok(importMap["w3c/prov-o"], "w3c/prov-o mapped")
    assert.ok(importMap["w3c/prov-o@2013"], "w3c/prov-o@2013 mapped")
    assert.ok(importMap["prov"], "short name 'prov' mapped")

    // Package path and relative filename mappings
    assert.ok(
      importMap[".ohi/w3c/prov-o/2013/prov-o.linkml.yaml"],
      "full package_path mapped"
    )
    assert.ok(importMap["prov-o.linkml.yaml"], "relative filename mapped")

    // Handled OWL Turtle artifact gracefully
    assert.ok(
      importMap[".ohi/w3c/dcat/3/dcat.owl.ttl"] ||
        imports[".ohi/w3c/dcat/3/dcat.owl.ttl"],
      "OWL Turtle artifact handled gracefully"
    )
  })

  it("compiles a LinkML ontology importing w3c/prov-o using importMap without UnknownReference errors", () => {
    const built = buildLinkmlImportsFromOhi(lockfile, artifacts)

    const schemaYaml = `
id: https://example.org/procurement-tracking
name: procurement_tracking
description: Tracking procurement lifecycle with PROV-O provenance
prefixes:
  track: https://example.org/procurement-tracking/
  prov: http://www.w3.org/ns/prov#
  linkml: https://w3id.org/linkml/
default_prefix: track
imports:
  - linkml:types
  - w3c/prov-o
classes:
  ProcurementAction:
    description: A procurement execution event
    is_a: prov:Activity
    attributes:
      action_id:
        range: string
        identifier: true
      started_at:
        range: datetime
slots:
  wasGeneratedBy:
    domain: ProcurementAction
    range: prov:Activity
`

    const compiled = compileLinkmlOntology(schemaYaml, {
      importMap: built.importMap,
    })

    // Assert multi-format compilation succeeded
    assert.ok(compiled.shacl_ttl.length > 0, "SHACL Turtle produced")
    assert.ok(compiled.rdfs_ttl.length > 0, "RDFS Turtle produced")
    assert.ok(compiled.owl_ttl.length > 0, "OWL 2 Turtle produced")
    assert.ok(compiled.pydantic_py.length > 0, "Pydantic code produced")

    assert.ok(
      compiled.shacl_ttl.includes("ProcurementAction"),
      "SHACL includes ProcurementAction"
    )
    assert.ok(
      compiled.owl_ttl.includes("ProcurementAction"),
      "OWL includes ProcurementAction"
    )
    assert.ok(
      compiled.pydantic_py.includes("class ProcurementAction"),
      "Pydantic includes ProcurementAction"
    )

    // Verify no UnknownReference errors
    const fatalOrRefErrors = compiled.lint_issues.filter(
      (issue) =>
        issue.severity === "FATAL" ||
        issue.issue_type === "UnknownReference" ||
        issue.issue_type === "SchemaImportError"
    )
    assert.deepEqual(
      fatalOrRefErrors,
      [],
      "No fatal or UnknownReference lint issues"
    )
  })

  it("compiles when importing by canonical URI (http://www.w3.org/ns/prov)", () => {
    const built = buildLinkmlImportsFromOhi(lockfile, artifacts)

    const schemaUriImport = `
id: https://example.org/prov-uri-test
name: prov_uri_test
description: Testing canonical URI import resolution
prefixes:
  test: https://example.org/prov-uri-test/
  prov: http://www.w3.org/ns/prov#
  linkml: https://w3id.org/linkml/
default_prefix: test
imports:
  - linkml:types
  - http://www.w3.org/ns/prov
classes:
  CustomActivity:
    description: Custom activity derived from prov:Activity
    is_a: prov:Activity
`

    const compiled = compileLinkmlOntology(schemaUriImport, {
      importMap: built.importMap,
    })

    assert.ok(compiled.shacl_ttl.length > 0)
    assert.ok(compiled.shacl_ttl.includes("CustomActivity"))
    const fatalOrRefErrors = compiled.lint_issues.filter(
      (issue) =>
        issue.severity === "FATAL" ||
        issue.issue_type === "UnknownReference" ||
        issue.issue_type === "SchemaImportError"
    )
    assert.deepEqual(fatalOrRefErrors, [])
  })

  it("compiles when importing by short name (prov)", () => {
    const built = buildLinkmlImportsFromOhi(lockfile, artifacts)

    const schemaShortImport = `
id: https://example.org/prov-short-test
name: prov_short_test
description: Testing short name import resolution
prefixes:
  test: https://example.org/prov-short-test/
  prov: http://www.w3.org/ns/prov#
  linkml: https://w3id.org/linkml/
default_prefix: test
imports:
  - linkml:types
  - prov
classes:
  ShortActivity:
    description: Custom activity derived from prov:Activity
    is_a: prov:Activity
`

    const compiled = compileLinkmlOntology(schemaShortImport, {
      imports: built.imports,
      importMap: built.importMap,
    })

    assert.ok(compiled.shacl_ttl.length > 0)
    assert.ok(compiled.shacl_ttl.includes("ShortActivity"))
    const fatalOrRefErrors = compiled.lint_issues.filter(
      (issue) =>
        issue.severity === "FATAL" ||
        issue.issue_type === "UnknownReference" ||
        issue.issue_type === "SchemaImportError"
    )
    assert.deepEqual(fatalOrRefErrors, [])
  })
})
