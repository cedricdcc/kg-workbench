import assert from "node:assert/strict"
import { test } from "node:test"
import {
  inspectOhiPublication,
  OhiPackageNotFoundError,
  resolveOhiDependencyTree,
  searchOhiPackages,
} from "../src/features/ontology/server/ohi/catalog-client"
import { BUILTIN_PUBLICATIONS } from "../src/features/ontology/server/ohi/builtin-publications"
import { computeSha256 } from "../src/features/ontology/server/ohi/manifest"
import type { OhiManifest } from "../src/features/ontology/server/ohi/types"

test("BUILTIN_PUBLICATIONS registry integrity", () => {
  const expectedOntologies = [
    "w3c/prov-o@2013",
    "w3c/dcat@3",
    "w3c/skos@2009",
    "dublincore/dcterms@2020",
    "w3c/ssn@2017",
    "w3c/org@2014",
    "foaf/foaf@0.1",
    "schemaorg/schema@28",
  ]

  for (const ref of expectedOntologies) {
    const pub = BUILTIN_PUBLICATIONS.get(ref)
    assert.ok(pub, `Built-in publication for ${ref} must exist`)
    assert.ok(pub.metadata.title, `Publication ${ref} must have title`)
    assert.ok(pub.metadata.base_url, `Publication ${ref} must have base_url`)
    assert.ok(
      pub.metadata.release_url,
      `Publication ${ref} must have release_url`
    )

    // Verify both linkml-yaml and owl-turtle artifacts exist
    const linkml = pub.artifacts["linkml-yaml"]
    assert.ok(linkml, `Publication ${ref} must have linkml-yaml artifact`)
    assert.ok(
      linkml.content.length > 0,
      `linkml-yaml artifact for ${ref} must not be empty`
    )
    const computedLinkmlSha = computeSha256(linkml.content)
    assert.equal(
      linkml.sha256,
      computedLinkmlSha,
      `SHA-256 mismatch for ${ref} linkml-yaml`
    )

    const turtle = pub.artifacts["owl-turtle"]
    assert.ok(turtle, `Publication ${ref} must have owl-turtle artifact`)
    assert.ok(
      turtle.content.length > 0,
      `owl-turtle artifact for ${ref} must not be empty`
    )
    const computedTurtleSha = computeSha256(turtle.content)
    assert.equal(
      turtle.sha256,
      computedTurtleSha,
      `SHA-256 mismatch for ${ref} owl-turtle`
    )
  }
})

test("searchOhiPackages returns matching packages across keywords and limits", async () => {
  const dcatResults = await searchOhiPackages("dcat")
  assert.ok(dcatResults.length >= 1)
  assert.equal(dcatResults[0].name, "dcat")
  assert.equal(dcatResults[0].namespace, "w3c")
  assert.equal(dcatResults[0].latest_version, "3")

  const provResults = await searchOhiPackages("prov")
  assert.ok(provResults.length >= 1)
  assert.equal(provResults[0].name, "prov-o")

  const skosResults = await searchOhiPackages("skos")
  assert.ok(skosResults.length >= 1)
  assert.equal(skosResults[0].name, "skos")

  // Limit check
  const allResults = await searchOhiPackages("", { limit: 3 })
  assert.equal(allResults.length, 3)

  // Empty match
  const noResults = await searchOhiPackages("nonexistent-pkg-query-xyz-12345")
  assert.equal(noResults.length, 0)
})

test("inspectOhiPublication returns metadata and artifacts for standard packages", async () => {
  const dcat = await inspectOhiPublication("w3c/dcat@3")
  assert.equal(dcat.namespace, "w3c")
  assert.equal(dcat.name, "dcat")
  assert.equal(dcat.version, "3")
  assert.equal(dcat.package_ref, "w3c/dcat@3")
  assert.ok(dcat.license, "dcat must specify license")
  assert.equal(dcat.base_url, "http://www.w3.org/ns/dcat#")
  assert.ok(dcat.artifacts["owl-turtle"], "dcat must have owl-turtle artifact")
  assert.ok(
    dcat.artifacts["linkml-yaml"],
    "dcat must have linkml-yaml artifact"
  )

  // Check dependencies: dcterms, skos, prov-o
  const depRefs = dcat.dependencies.map((d) => d.ontology)
  assert.ok(depRefs.includes("dublincore/dcterms@2020"))
  assert.ok(depRefs.includes("w3c/skos@2009"))
  assert.ok(depRefs.includes("w3c/prov-o@2013"))

  // Version omitted should resolve to latest version
  const dcatLatest = await inspectOhiPublication("w3c/dcat")
  assert.equal(dcatLatest.version, "3")
  assert.equal(dcatLatest.package_ref, "w3c/dcat@3")

  const prov = await inspectOhiPublication("w3c/prov-o@2013")
  assert.equal(prov.name, "prov-o")
  assert.equal(prov.dependencies.length, 0)

  // Nonexistent package throws OhiPackageNotFoundError
  await assert.rejects(
    async () => inspectOhiPublication("unknown/package@1"),
    (err: unknown) => {
      assert.ok(err instanceof OhiPackageNotFoundError)
      return true
    }
  )
})

test("resolveOhiDependencyTree resolves w3c/dcat@3 and all transitive dependencies", async () => {
  const manifest: OhiManifest = {
    format_version: 1,
    default_format: "owl-turtle",
    download_dir: ".ohi",
    dependencies: [{ ontology: "w3c/dcat@3" }],
  }

  const { lockfile, artifacts } = await resolveOhiDependencyTree(manifest)

  assert.equal(lockfile.lock_version, 2)
  assert.equal(lockfile.selections.length, 1)
  assert.equal(lockfile.selections[0].ontology, "w3c/dcat@3")
  assert.ok(lockfile.selections[0].release_url)
  assert.ok(lockfile.selections[0].artifact_url)
  assert.equal(lockfile.selections[0].format, "owl-turtle")

  // Files must contain direct (dcat@3) and 3 transitive (dcterms@2020, skos@2009, prov-o@2013)
  assert.equal(lockfile.files.length, 4)
  const lockedPaths = lockfile.files.map((f) => f.package_path)
  assert.ok(lockedPaths.some((p) => p.includes("w3c/dcat/3/")))
  assert.ok(lockedPaths.some((p) => p.includes("dublincore/dcterms/2020/")))
  assert.ok(lockedPaths.some((p) => p.includes("w3c/skos/2009/")))
  assert.ok(lockedPaths.some((p) => p.includes("w3c/prov-o/2013/")))

  // Check SHA-256 checksums and artifact contents
  for (const file of lockfile.files) {
    assert.ok(file.package_path)
    assert.ok(file.base_url)
    assert.ok(file.url)
    assert.equal(file.format, "owl-turtle")
    assert.ok(file.sha256)

    const content = artifacts.get(file.package_path)
    assert.ok(
      content,
      `Artifact for ${file.package_path} must be populated in artifacts map`
    )
    assert.equal(computeSha256(content), file.sha256)

    // Artifacts map also indexable by URL
    assert.equal(artifacts.get(file.url), content)
  }
})

test("resolveOhiDependencyTree respects target format linkml-yaml", async () => {
  const manifest: OhiManifest = {
    format_version: 1,
    default_format: "linkml-yaml",
    download_dir: ".ohi",
    dependencies: [{ ontology: "w3c/prov-o@2013" }],
  }

  const { lockfile, artifacts } = await resolveOhiDependencyTree(manifest)

  assert.equal(lockfile.selections.length, 1)
  assert.equal(lockfile.selections[0].format, "linkml-yaml")
  assert.equal(lockfile.files.length, 1)
  assert.equal(lockfile.files[0].format, "linkml-yaml")
  assert.ok(lockfile.files[0].package_path.endsWith(".linkml.yaml"))

  const content = artifacts.get(lockfile.files[0].package_path)!
  assert.ok(content.includes("Entity:"))
  assert.equal(computeSha256(content), lockfile.files[0].sha256)
})

test("resolveOhiDependencyTree deduplicates shared transitive dependencies", async () => {
  // Both dcat@3 and prov-o@2013 specified directly; dcat@3 also depends on prov-o@2013
  const manifest: OhiManifest = {
    format_version: 1,
    default_format: "owl-turtle",
    download_dir: ".ohi",
    dependencies: [{ ontology: "w3c/dcat@3" }, { ontology: "w3c/prov-o@2013" }],
  }

  const { lockfile } = await resolveOhiDependencyTree(manifest)

  // selections must reflect both user requests
  assert.equal(lockfile.selections.length, 2)
  assert.equal(lockfile.selections[0].ontology, "w3c/dcat@3")
  assert.equal(lockfile.selections[1].ontology, "w3c/prov-o@2013")

  // files deduplicates prov-o@2013: 4 files total (dcat, dcterms, skos, prov-o)
  assert.equal(lockfile.files.length, 4)
  const provFiles = lockfile.files.filter((f) =>
    f.package_path.includes("prov-o")
  )
  assert.equal(
    provFiles.length,
    1,
    "w3c/prov-o@2013 must appear exactly once in files"
  )
})

test("resolveOhiDependencyTree handles diamond versions without collision", async () => {
  // Requesting two different versions of dublincore/dcterms: 2020 and 2012
  const manifest: OhiManifest = {
    format_version: 1,
    default_format: "owl-turtle",
    download_dir: ".ohi",
    dependencies: [
      { ontology: "dublincore/dcterms@2020" },
      { ontology: "dublincore/dcterms@2012" },
    ],
  }

  const { lockfile, artifacts } = await resolveOhiDependencyTree(manifest)

  assert.equal(lockfile.selections.length, 2)
  assert.equal(lockfile.files.length, 2)

  const path2020 = lockfile.files.find((f) =>
    f.package_path.includes("2020")
  )?.package_path
  const path2012 = lockfile.files.find((f) =>
    f.package_path.includes("2012")
  )?.package_path

  assert.ok(path2020, "2020 version path must exist")
  assert.ok(path2012, "2012 version path must exist")
  assert.notEqual(path2020, path2012, "Paths must not collide")

  assert.ok(artifacts.get(path2020!))
  assert.ok(artifacts.get(path2012!))
})

test("offline / air-gapped resolution succeeds when network fails", async () => {
  const originalFetch = globalThis.fetch
  try {
    // Mock fetch to simulate complete network outage or air-gapped Docker container
    globalThis.fetch = async () => {
      throw new Error("ENOTFOUND ohi.dev (air-gapped network)")
    }

    const searchResults = await searchOhiPackages("skos", {
      catalogUrl: "https://ohi.dev",
    })
    assert.ok(searchResults.length > 0)
    assert.equal(searchResults[0].name, "skos")

    const pub = await inspectOhiPublication("w3c/prov-o@2013", {
      catalogUrl: "https://ohi.dev",
    })
    assert.equal(pub.name, "prov-o")

    const manifest: OhiManifest = {
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [{ ontology: "w3c/org@2014" }],
    }

    const { lockfile, artifacts } = await resolveOhiDependencyTree(manifest, {
      catalogUrl: "https://ohi.dev",
      offlineOnly: true,
    })

    assert.equal(lockfile.selections.length, 1)
    // org@2014 depends on foaf@0.1 and dcterms@2020
    assert.equal(lockfile.files.length, 3)
    for (const file of lockfile.files) {
      assert.ok(artifacts.has(file.package_path))
      assert.equal(
        computeSha256(artifacts.get(file.package_path)!),
        file.sha256
      )
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})
