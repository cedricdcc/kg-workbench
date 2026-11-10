import YAML from "yaml"
import { parsePackageRef } from "./builtin-publications"
import { findArtifactContent } from "./lockfile-verifier"
import type { OhiLockedFile, OhiLockfileV2 } from "./types"

/**
 * Injects CURIE aliases into LinkML YAML (e.g. `prov:Activity: is_a: Activity`)
 * so that schemas importing the vocabulary can reference elements using either
 * unqualified names (`Activity`) or CURIE-prefixed names (`prov:Activity`).
 */
function injectCurieAliases(
  content: string,
  parsed: Record<string, unknown>
): string {
  const prefix =
    (typeof parsed.default_prefix === "string" && parsed.default_prefix) ||
    (typeof parsed.name === "string" && parsed.name)

  if (!prefix) {
    return content
  }

  let augmented = content

  // 1. Class CURIE aliases
  if (parsed.classes && typeof parsed.classes === "object") {
    const classNames = Object.keys(parsed.classes)
    const classAdditions: string[] = []
    for (const cls of classNames) {
      if (
        !cls.includes(":") &&
        !(`${prefix}:${cls}` in (parsed.classes as object))
      ) {
        classAdditions.push(`  ${prefix}:${cls}:\n    is_a: ${cls}`)
      }
    }
    if (classAdditions.length > 0) {
      const match = augmented.match(/^classes:\s*$/m)
      if (match && match.index !== undefined) {
        const insertPos = match.index + match[0].length
        augmented =
          augmented.slice(0, insertPos) +
          "\n" +
          classAdditions.join("\n") +
          augmented.slice(insertPos)
      }
    }
  }

  // 2. Slot CURIE aliases
  if (parsed.slots && typeof parsed.slots === "object") {
    const slotNames = Object.keys(parsed.slots)
    const slotAdditions: string[] = []
    for (const slot of slotNames) {
      if (
        !slot.includes(":") &&
        !(`${prefix}:${slot}` in (parsed.slots as object))
      ) {
        slotAdditions.push(`  ${prefix}:${slot}:\n    is_a: ${slot}`)
      }
    }
    if (slotAdditions.length > 0) {
      const match = augmented.match(/^slots:\s*$/m)
      if (match && match.index !== undefined) {
        const insertPos = match.index + match[0].length
        augmented =
          augmented.slice(0, insertPos) +
          "\n" +
          slotAdditions.join("\n") +
          augmented.slice(insertPos)
      }
    }
  }

  return augmented
}

/**
 * Builds LinkML imports and importMap dictionaries from an ohi.lock.json lockfile
 * and stored artifacts.
 *
 * Maps canonical schema IDs (e.g. `http://www.w3.org/ns/prov`), package paths,
 * package names (`prov`, `w3c/prov-o`), and relative filenames to their raw YAML contents.
 *
 * OWL Turtle and other non-LinkML artifacts are safely indexed in `imports` without failure.
 */
export function buildLinkmlImportsFromOhi(
  lockfile: OhiLockfileV2,
  storedArtifacts: Record<string, string> | Map<string, string>
): {
  imports: Record<string, string>
  importMap: Record<string, string>
} {
  const imports: Record<string, string> = {}
  const importMap: Record<string, string> = {}

  // Process non-LinkML files first and LinkML files second, so that LinkML schemas
  // always take precedence for package names and canonical IDs in import resolution.
  const sortedFiles = [...lockfile.files].sort((a, b) => {
    const aIsLinkml = a.format === "linkml-yaml" ? 1 : 0
    const bIsLinkml = b.format === "linkml-yaml" ? 1 : 0
    return aIsLinkml - bIsLinkml
  })

  for (const file of sortedFiles) {
    const content = findArtifactContent(storedArtifacts, file)
    if (content === undefined || content === null) {
      continue
    }

    const isLinkml =
      file.format === "linkml-yaml" ||
      file.package_path.endsWith(".linkml.yaml") ||
      file.package_path.endsWith(".yaml") ||
      file.package_path.endsWith(".yml")

    let effectiveContent = content
    let parsed: Record<string, unknown> | null = null

    if (isLinkml) {
      try {
        const doc = YAML.parse(content)
        if (doc && typeof doc === "object" && !Array.isArray(doc)) {
          parsed = doc as Record<string, unknown>
          effectiveContent = injectCurieAliases(content, parsed)
        }
      } catch {
        // Fall back to raw content if YAML parsing fails
      }
    }

    const registerMapping = (key: string | undefined, force = false) => {
      if (!key) return
      const trimmed = key.trim()
      if (!trimmed) return
      // Only set if isLinkml, forced, or key not yet occupied by a LinkML schema
      if (isLinkml || force || !imports[trimmed]) {
        imports[trimmed] = effectiveContent
        importMap[trimmed] = effectiveContent
      }
    }

    // 1. Lockfile path keys (always registered for exact lookup)
    registerMapping(file.package_path, true)
    registerMapping(file.path, true)
    registerMapping(file.url, true)
    registerMapping(file.base_url, isLinkml)

    // 2. Relative paths and filename aliases
    if (file.package_path) {
      const normalized = file.package_path.replace(/\\/g, "/")
      registerMapping(normalized, true)
      registerMapping(normalized.replace(/^\.?\/?\.?ohi\//, ""), true)

      const fileName = normalized.split("/").pop()
      registerMapping(fileName, true)
      if (fileName && fileName.endsWith(".linkml.yaml")) {
        registerMapping(fileName.replace(/\.linkml\.yaml$/, ".yaml"), true)
      }
    }

    // 3. Package name & ontology ref aliases
    // For non-LinkML artifacts, only register if no LinkML artifact has claimed this package.
    if (file.ontology) {
      registerMapping(file.ontology, isLinkml)
      const parsedRef = parsePackageRef(file.ontology)
      if (parsedRef.namespace && parsedRef.name) {
        registerMapping(`${parsedRef.namespace}/${parsedRef.name}`, isLinkml)
      }
      registerMapping(parsedRef.name, isLinkml)
    }

    // 4. Schema metadata keys (id, name, default_prefix) from LinkML YAML header
    if (parsed) {
      if (typeof parsed.id === "string" && parsed.id) {
        registerMapping(parsed.id, true)
        registerMapping(parsed.id.replace(/\/+$/, ""), true)
        registerMapping(parsed.id.replace(/#+$/, ""), true)
      }
      if (typeof parsed.name === "string" && parsed.name) {
        registerMapping(parsed.name, true)
      }
      if (typeof parsed.default_prefix === "string" && parsed.default_prefix) {
        registerMapping(parsed.default_prefix, true)
      }
    }
  }

  return {
    imports,
    importMap,
  }
}
