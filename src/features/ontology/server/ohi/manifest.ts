import { createHash } from "node:crypto"
import YAML from "yaml"
import {
  OhiLockfileV2Schema,
  OhiManifestSchema,
  type OhiLockfileV2,
  type OhiManifest,
} from "./types"

/**
 * Custom error thrown when parsing or validating an ohi.yaml manifest fails.
 */
export class OhiParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "OhiParseError"
  }
}

/**
 * Custom error thrown when parsing or validating an ohi.lock.json lockfile fails.
 */
export class OhiLockfileParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "OhiLockfileParseError"
  }
}

/**
 * Compute the lowercase hexadecimal SHA-256 digest of string or binary content.
 */
export function computeSha256(content: string | Uint8Array): string {
  const hash = createHash("sha256")
  if (typeof content === "string") {
    hash.update(content, "utf8")
  } else {
    hash.update(content)
  }
  return hash.digest("hex")
}

/**
 * Parse and validate a YAML string into a strongly typed OhiManifest.
 *
 * @throws {OhiParseError} If YAML syntax is invalid or schema validation fails.
 */
export function parseOhiYaml(yamlText: string): OhiManifest {
  if (typeof yamlText !== "string" || !yamlText.trim()) {
    throw new OhiParseError("ohi.yaml manifest content cannot be empty")
  }

  let parsed: unknown
  try {
    parsed = YAML.parse(yamlText)
  } catch (err) {
    throw new OhiParseError(
      `Failed to parse ohi.yaml YAML syntax: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OhiParseError("ohi.yaml root structure must be a YAML mapping")
  }

  const result = OhiManifestSchema.safeParse(parsed)
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join(", ")
    throw new OhiParseError(
      `Invalid ohi.yaml manifest structure: ${errorDetails}`,
      result.error
    )
  }

  return result.data
}

/**
 * Serialize an OhiManifest into standardized YAML representation.
 */
export function serializeOhiYaml(manifest: OhiManifest): string {
  const validated = OhiManifestSchema.parse(manifest)
  const cleanManifest: Record<string, unknown> = {
    format_version: validated.format_version,
    default_format: validated.default_format,
    download_dir: validated.download_dir,
    dependencies: validated.dependencies.map((dep) => {
      const entry: Record<string, unknown> = { ontology: dep.ontology }
      if (dep.format) {
        entry.format = dep.format
      }
      return entry
    }),
  }
  return YAML.stringify(cleanManifest, { indent: 2, lineWidth: 0 })
}

/**
 * Parse and validate a JSON string into a strongly typed OhiLockfileV2.
 *
 * @throws {OhiLockfileParseError} If JSON syntax is invalid or schema validation fails.
 */
export function parseOhiLockfile(jsonText: string): OhiLockfileV2 {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    throw new OhiLockfileParseError(
      "ohi.lock.json lockfile content cannot be empty"
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new OhiLockfileParseError(
      `Failed to parse ohi.lock.json JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OhiLockfileParseError(
      "ohi.lock.json root structure must be a JSON object"
    )
  }

  const result = OhiLockfileV2Schema.safeParse(parsed)
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join(", ")
    throw new OhiLockfileParseError(
      `Invalid ohi.lock.json v2 structure: ${errorDetails}`,
      result.error
    )
  }

  return result.data
}

/**
 * Serialize an OhiLockfileV2 into standard formatted JSON with trailing newline.
 */
export function serializeOhiLockfile(lockfile: OhiLockfileV2): string {
  const validated = OhiLockfileV2Schema.parse(lockfile)
  return JSON.stringify(validated, null, 2) + "\n"
}
