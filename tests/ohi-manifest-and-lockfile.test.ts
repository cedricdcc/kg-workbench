import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  computeSha256,
  OhiLockfileParseError,
  OhiParseError,
  parseOhiLockfile,
  parseOhiYaml,
  serializeOhiLockfile,
  serializeOhiYaml,
} from "../src/features/ontology/server/ohi/manifest"
import {
  OhiFormatSchema,
  OhiLockfileV2Schema,
  OhiManifestSchema,
  type OhiLockfileV2,
  type OhiManifest,
} from "../src/features/ontology/server/ohi/types"

describe("computeSha256", () => {
  it("computes deterministic SHA-256 for strings and Uint8Array buffers against known digests", () => {
    // Known SHA-256 digests
    assert.equal(
      computeSha256(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "empty string digest should match NIST test vector"
    )

    const expectedHelloWorld =
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    assert.equal(computeSha256("hello world"), expectedHelloWorld)

    const encoded = new TextEncoder().encode("hello world")
    assert.equal(computeSha256(encoded), expectedHelloWorld)

    // Multi-byte UTF-8
    const unicodeText = "w3c/dcat@3: 🚀 Data Catalog Vocabulary"
    assert.equal(
      computeSha256(unicodeText),
      computeSha256(new TextEncoder().encode(unicodeText))
    )
  })
})

describe("ohi.yaml parser & serializer", () => {
  const specExampleYaml = `format_version: 1
default_format: owl-turtle
download_dir: .ohi
dependencies:
  - ontology: w3c/dcat@3
    format: owl-turtle
  - ontology: w3c/prov-o@2013
    format: linkml-yaml
`

  it("parses the exact spec example into an OhiManifest structure", () => {
    const manifest = parseOhiYaml(specExampleYaml)

    assert.equal(manifest.format_version, 1)
    assert.equal(manifest.default_format, "owl-turtle")
    assert.equal(manifest.download_dir, ".ohi")
    assert.equal(manifest.dependencies.length, 2)

    assert.deepEqual(manifest.dependencies[0], {
      ontology: "w3c/dcat@3",
      format: "owl-turtle",
    })
    assert.deepEqual(manifest.dependencies[1], {
      ontology: "w3c/prov-o@2013",
      format: "linkml-yaml",
    })
  })

  it("round-trips OhiManifest serialization and re-parsing losslessly", () => {
    const originalManifest: OhiManifest = {
      format_version: 1,
      default_format: "owl-turtle",
      download_dir: ".ohi",
      dependencies: [
        { ontology: "w3c/dcat@3", format: "owl-turtle" },
        { ontology: "w3c/prov-o@2013", format: "linkml-yaml" },
        { ontology: "dublincore/dcterms@2020" },
      ],
    }

    const serialized = serializeOhiYaml(originalManifest)
    const reloaded = parseOhiYaml(serialized)

    assert.deepEqual(reloaded, originalManifest)
  })

  it("applies defaults when format_version, default_format, or download_dir are omitted", () => {
    const minimalYaml = `
dependencies:
  - ontology: w3c/skos@2009
`
    const manifest = parseOhiYaml(minimalYaml)
    assert.equal(manifest.format_version, 1)
    assert.equal(manifest.default_format, "owl-turtle")
    assert.equal(manifest.download_dir, ".ohi")
    assert.equal(manifest.dependencies.length, 1)
    assert.equal(manifest.dependencies[0].ontology, "w3c/skos@2009")
  })

  it("handles empty or missing dependencies list gracefully", () => {
    const emptyDepsYaml = `
format_version: 1
default_format: linkml-yaml
download_dir: .deps
`
    const manifest = parseOhiYaml(emptyDepsYaml)
    assert.deepEqual(manifest.dependencies, [])
  })

  it("throws OhiParseError on empty or whitespace-only YAML string", () => {
    assert.throws(
      () => parseOhiYaml(""),
      (err: unknown) => err instanceof OhiParseError
    )
    assert.throws(
      () => parseOhiYaml("   \n\t  "),
      (err: unknown) => err instanceof OhiParseError
    )
  })

  it("throws OhiParseError on invalid YAML syntax", () => {
    const brokenYaml = `
format_version: [unclosed list
dependencies:
`
    assert.throws(
      () => parseOhiYaml(brokenYaml),
      (err: unknown) => err instanceof OhiParseError
    )
  })

  it("throws OhiParseError when dependency is missing 'ontology' or format is invalid", () => {
    const missingOntology = `
format_version: 1
dependencies:
  - format: owl-turtle
`
    assert.throws(
      () => parseOhiYaml(missingOntology),
      (err: unknown) => err instanceof OhiParseError
    )

    const invalidFormat = `
format_version: 1
dependencies:
  - ontology: w3c/dcat@3
    format: unsupported-binary
`
    assert.throws(
      () => parseOhiYaml(invalidFormat),
      (err: unknown) => err instanceof OhiParseError
    )
  })
})

describe("ohi.lock.json v2 parser & serializer", () => {
  const sampleLockfile: OhiLockfileV2 = {
    lock_version: 2,
    selections: [
      {
        ontology: "w3c/dcat@3",
        release_url: "https://ohi.dev/w3c/dcat/releases/3",
        artifact_url: "https://ohi.dev/w3c/dcat/3/dcat.owl.ttl",
        format: "owl-turtle",
      },
      {
        ontology: "w3c/prov-o@2013",
        release_url: "https://ohi.dev/w3c/prov-o/releases/2013",
        artifact_url: "https://ohi.dev/w3c/prov-o/2013/prov-o.linkml.yaml",
        format: "linkml-yaml",
      },
    ],
    files: [
      {
        package_path: ".ohi/w3c/dcat/3/dcat.owl.ttl",
        base_url: "https://ohi.dev/w3c/dcat",
        url: "https://ohi.dev/w3c/dcat/3/dcat.owl.ttl",
        format: "owl-turtle",
        sha256:
          "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
      },
      {
        package_path: ".ohi/w3c/prov-o/2013/prov-o.linkml.yaml",
        base_url: "https://ohi.dev/w3c/prov-o",
        url: "https://ohi.dev/w3c/prov-o/2013/prov-o.linkml.yaml",
        format: "linkml-yaml",
        sha256:
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    ],
  }

  it("round-trips OhiLockfileV2 serialization and parsing losslessly", () => {
    const serialized = serializeOhiLockfile(sampleLockfile)
    assert.ok(
      serialized.endsWith("\n"),
      "serialized JSON should end with newline"
    )

    const parsed = parseOhiLockfile(serialized)
    assert.equal(parsed.lock_version, 2)
    assert.equal(parsed.selections.length, 2)
    assert.equal(parsed.files.length, 2)
    assert.equal(parsed.files[0].package_path, ".ohi/w3c/dcat/3/dcat.owl.ttl")
    assert.equal(parsed.files[0].path, ".ohi/w3c/dcat/3/dcat.owl.ttl")
  })

  it("normalizes path and package_path aliases seamlessly in files", () => {
    const rawJson = JSON.stringify({
      lock_version: 2,
      selections: [{ ontology: "w3c/skos@2009" }],
      files: [
        {
          path: ".ohi/w3c/skos/2009/skos.linkml.yaml",
          base_url: "https://ohi.dev/w3c/skos",
          url: "https://ohi.dev/w3c/skos/2009/skos.linkml.yaml",
          format: "linkml-yaml",
          sha256:
            "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        },
      ],
    })

    const parsed = parseOhiLockfile(rawJson)
    assert.equal(
      parsed.files[0].package_path,
      ".ohi/w3c/skos/2009/skos.linkml.yaml"
    )
    assert.equal(parsed.files[0].path, ".ohi/w3c/skos/2009/skos.linkml.yaml")
  })

  it("throws OhiLockfileParseError when lock_version is not 2", () => {
    const invalidLockVersion = JSON.stringify({
      lock_version: 1,
      selections: [],
      files: [],
    })
    assert.throws(
      () => parseOhiLockfile(invalidLockVersion),
      (err: unknown) => err instanceof OhiLockfileParseError
    )
  })

  it("throws OhiLockfileParseError on invalid JSON syntax", () => {
    assert.throws(
      () => parseOhiLockfile("{ lock_version: 2 broken json }"),
      (err: unknown) => err instanceof OhiLockfileParseError
    )
  })

  it("throws OhiLockfileParseError when file is missing sha256 or package_path", () => {
    const missingSha = JSON.stringify({
      lock_version: 2,
      selections: [],
      files: [
        {
          package_path: ".ohi/test.ttl",
          base_url: "https://ohi.dev/test",
          url: "https://ohi.dev/test.ttl",
          format: "owl-turtle",
          // missing sha256
        },
      ],
    })
    assert.throws(
      () => parseOhiLockfile(missingSha),
      (err: unknown) => err instanceof OhiLockfileParseError
    )
  })
})

describe("Zod schemas runtime validation", () => {
  it("OhiFormatSchema accepts all valid formats and rejects invalid ones", () => {
    assert.equal(OhiFormatSchema.parse("owl-turtle"), "owl-turtle")
    assert.equal(OhiFormatSchema.parse("owl-rdfxml"), "owl-rdfxml")
    assert.equal(OhiFormatSchema.parse("rdfs-turtle"), "rdfs-turtle")
    assert.equal(OhiFormatSchema.parse("linkml-yaml"), "linkml-yaml")
    assert.equal(OhiFormatSchema.parse("ossie-yaml"), "ossie-yaml")

    assert.equal(OhiFormatSchema.safeParse("json-ld").success, false)
    assert.equal(OhiFormatSchema.safeParse("").success, false)
  })

  it("OhiManifestSchema and OhiLockfileV2Schema validate typed structures", () => {
    const validManifest = OhiManifestSchema.parse({
      format_version: 1,
      default_format: "linkml-yaml",
      download_dir: ".ohi",
      dependencies: [{ ontology: "w3c/prov-o@2013", format: "linkml-yaml" }],
    })
    assert.equal(validManifest.dependencies[0].ontology, "w3c/prov-o@2013")

    const validLockfile = OhiLockfileV2Schema.parse({
      lock_version: 2,
      selections: [{ ontology: "w3c/prov-o@2013" }],
      files: [
        {
          package_path: ".ohi/prov.yaml",
          base_url: "https://ohi.dev/prov",
          url: "https://ohi.dev/prov.yaml",
          format: "linkml-yaml",
          sha256: "deadbeef",
        },
      ],
    })
    assert.equal(validLockfile.lock_version, 2)
  })
})
