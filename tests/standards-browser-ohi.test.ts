import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildOhiPackageState,
  resolveAndSyncOhiManifest,
  addDependencyToManifest,
  removeDependencyFromManifest,
} from "../src/features/ontology/server/ohi/package-manager"
import {
  inspectOhiPackageTreeAction,
  searchOhiCatalogAction,
} from "../src/features/ontology/server/actions/ohi-packages"
import {
  parseOhiYaml,
  serializeOhiYaml,
} from "../src/features/ontology/server/ohi/manifest"
import { verifyOhiLockfileArtifacts } from "../src/features/ontology/server/ohi/lockfile-verifier"
import type { OhiManifest } from "../src/features/ontology/server/ohi/types"

describe("StandardsBrowser ohi.dev package manager & lockfile contracts", () => {
  it("searchOhiCatalogAction returns matching ohi.dev packages", async () => {
    const results = await searchOhiCatalogAction("dcat", { offlineOnly: true })
    assert.ok(results.length >= 1)
    assert.equal(results[0]?.package_ref, "w3c/dcat")
    assert.equal(results[0]?.latest_version, "3")
    assert.equal(results[0]?.namespace, "w3c")
    assert.equal(results[0]?.name, "dcat")
  })

  it("inspectOhiPackageTreeAction distinguishes direct and transitive dependencies for w3c/dcat@3", async () => {
    const preview = await inspectOhiPackageTreeAction(
      "w3c/dcat@3",
      "linkml-yaml",
      { offlineOnly: true }
    )

    assert.equal(preview.publication.package_ref, "w3c/dcat@3")
    assert.equal(preview.selectedFormat, "linkml-yaml")

    assert.equal(preview.directPackages.length, 1)
    assert.equal(preview.directPackages[0]?.packageRef, "w3c/dcat@3")
    assert.equal(preview.directPackages[0]?.isDirect, true)
    assert.ok(preview.directPackages[0]?.sha256.length === 64)

    const transitiveRefs = preview.transitivePackages.map((p) => p.packageRef)
    assert.ok(
      transitiveRefs.includes("w3c/prov-o@2013"),
      `Expected w3c/prov-o@2013 in transitive deps, got: ${transitiveRefs.join(", ")}`
    )
    assert.ok(
      transitiveRefs.includes("w3c/skos@2009"),
      `Expected w3c/skos@2009 in transitive deps, got: ${transitiveRefs.join(", ")}`
    )
    assert.ok(
      transitiveRefs.includes("dublincore/dcterms@2020"),
      `Expected dublincore/dcterms@2020 in transitive deps, got: ${transitiveRefs.join(", ")}`
    )
    assert.ok(
      !transitiveRefs.includes("w3c/dcat@3"),
      "Direct package w3c/dcat@3 must not appear in transitivePackages"
    )
    for (const node of preview.transitivePackages) {
      assert.equal(node.isDirect, false)
      assert.equal(node.sha256.length, 64)
    }
  })

  it("buildOhiPackageState reports 'empty' when manifest has no dependencies and no lockfile", () => {
    const state = buildOhiPackageState({
      ontologyId: "ont-1",
      ohiYaml: "",
      lockfile: null,
      storedArtifacts: new Map(),
    })

    assert.equal(state.ontologyId, "ont-1")
    assert.equal(state.status, "empty")
    assert.equal(state.packages.length, 0)
    assert.equal(state.verification.valid, true)
    assert.equal(state.verification.checked_files_count, 0)
  })

  it("addDependencyToManifest + resolveAndSyncOhiManifest produces verified lockfile and state", async () => {
    const initialManifest: OhiManifest = {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [],
    }

    const updatedManifest = addDependencyToManifest(initialManifest, {
      ontology: "w3c/dcat@3",
      format: "linkml-yaml",
    })
    assert.equal(updatedManifest.dependencies.length, 1)

    const yamlText = serializeOhiYaml(updatedManifest)
    assert.deepEqual(parseOhiYaml(yamlText).dependencies, [
      { ontology: "w3c/dcat@3", format: "linkml-yaml" },
    ])

    const synced = await resolveAndSyncOhiManifest(updatedManifest, {
      offlineOnly: true,
    })

    const report = verifyOhiLockfileArtifacts(synced.lockfile, synced.artifacts)
    assert.equal(report.valid, true)
    assert.equal(report.mismatched_files.length, 0)

    const state = buildOhiPackageState({
      ontologyId: "ont-1",
      ohiYaml: yamlText,
      lockfile: synced.lockfile,
      storedArtifacts: synced.artifacts,
    })

    assert.equal(state.status, "verified")
    assert.equal(state.verification.valid, true)
    assert.ok(state.packages.some((p) => p.packageRef === "w3c/dcat@3" && p.isDirect))
    assert.ok(
      state.packages.some((p) => p.packageRef === "w3c/prov-o@2013" && !p.isDirect)
    )
    assert.ok(state.packages.every((p) => p.verified && p.mismatchReason === null))
  })

  it("buildOhiPackageState flags 'drifted' when a cached artifact is tampered or missing, and ohi sync recovers it", async () => {
    const manifest: OhiManifest = {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [{ ontology: "w3c/prov-o@2013", format: "linkml-yaml" }],
    }

    const synced = await resolveAndSyncOhiManifest(manifest, {
      offlineOnly: true,
    })

    // Tamper with the artifact
    const tamperedArtifacts = new Map(synced.artifacts)
    const targetFile = synced.lockfile.files[0]!
    tamperedArtifacts.set(targetFile.package_path, "# tampered content")
    if (targetFile.path) tamperedArtifacts.set(targetFile.path, "# tampered content")
    if (targetFile.url) tamperedArtifacts.set(targetFile.url, "# tampered content")

    const driftedState = buildOhiPackageState({
      ontologyId: "ont-1",
      ohiYaml: serializeOhiYaml(manifest),
      lockfile: synced.lockfile,
      storedArtifacts: tamperedArtifacts,
    })

    assert.equal(driftedState.status, "drifted")
    assert.equal(driftedState.verification.valid, false)
    assert.equal(driftedState.verification.mismatched_files.length, 1)
    assert.equal(driftedState.packages[0]?.verified, false)
    assert.equal(driftedState.packages[0]?.mismatchReason, "tampered")

    // Re-sync via ohi sync
    const resynced = await resolveAndSyncOhiManifest(manifest, {
      offlineOnly: true,
    })
    const recoveredState = buildOhiPackageState({
      ontologyId: "ont-1",
      ohiYaml: serializeOhiYaml(manifest),
      lockfile: resynced.lockfile,
      storedArtifacts: resynced.artifacts,
    })

    assert.equal(recoveredState.status, "verified")
    assert.equal(recoveredState.verification.valid, true)
    assert.equal(recoveredState.packages[0]?.verified, true)
    assert.equal(recoveredState.packages[0]?.mismatchReason, null)
  })

  it("removeDependencyFromManifest removes a direct dependency cleanly", () => {
    const manifest: OhiManifest = {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [
        { ontology: "w3c/dcat@3", format: "linkml-yaml" },
        { ontology: "w3c/skos@2009", format: "owl-turtle" },
      ],
    }

    const updated = removeDependencyFromManifest(manifest, "w3c/dcat@3")
    assert.equal(updated.dependencies.length, 1)
    assert.equal(updated.dependencies[0]?.ontology, "w3c/skos@2009")
  })
})
