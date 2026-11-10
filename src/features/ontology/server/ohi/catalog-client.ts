import {
  getBuiltinPackageSummaries,
  getBuiltinPublication,
  type OhiArtifactDescriptor,
  type OhiPackageSummary,
  type OhiPublicationMetadata,
} from "./builtin-publications"
import { computeSha256 } from "./manifest"
import type {
  OhiFormat,
  OhiLockedFile,
  OhiLockfileV2,
  OhiLockSelection,
  OhiManifest,
} from "./types"

/**
 * Custom error thrown when an ohi package or publication cannot be located.
 */
export class OhiPackageNotFoundError extends Error {
  constructor(
    public readonly packageRef: string,
    message?: string
  ) {
    super(
      message ||
        `Package publication '${packageRef}' not found in catalog or built-in registry`
    )
    this.name = "OhiPackageNotFoundError"
  }
}

export interface SearchOhiOptions {
  limit?: number
  catalogUrl?: string
  offlineOnly?: boolean
}

export interface InspectOhiOptions {
  catalogUrl?: string
  offlineOnly?: boolean
}

export interface ResolveOhiOptions {
  catalogUrl?: string
  offlineOnly?: boolean
}

/**
 * Standard file extensions for each supported artifact format.
 */
const FORMAT_EXTENSIONS: Record<OhiFormat, string> = {
  "linkml-yaml": "linkml.yaml",
  "owl-turtle": "owl.ttl",
  "owl-rdfxml": "owl.rdf",
  "rdfs-turtle": "rdfs.ttl",
  "ossie-yaml": "ossie.yaml",
}

/**
 * Normalizes URL with custom catalog base URL if provided.
 */
function normalizeCatalogUrl(url: string, catalogUrl?: string): string {
  if (!catalogUrl || catalogUrl === "https://ohi.dev") {
    return url
  }
  return url.replace(/^https:\/\/ohi\.dev/, catalogUrl.replace(/\/+$/, ""))
}

/**
 * Search the ohi.dev catalog for packages matching the given query string.
 * Resiliently falls back to built-in packages if the external catalog is unreachable or offline.
 */
export async function searchOhiPackages(
  query: string,
  options?: SearchOhiOptions
): Promise<OhiPackageSummary[]> {
  const limit = options?.limit ?? 20
  const catalogUrl = options?.catalogUrl || "https://ohi.dev"
  const isOffline =
    options?.offlineOnly ||
    process.env.OFFLINE_MODE === "true" ||
    catalogUrl.startsWith("mock://offline")

  // Attempt live HTTP search if not disabled
  if (!isOffline && catalogUrl) {
    try {
      const searchEndpoint = `${catalogUrl.replace(/\/+$/, "")}/api/v1/packages?q=${encodeURIComponent(query)}&limit=${limit}`
      const response = await fetch(searchEndpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        const data = (await response.json()) as {
          packages?: OhiPackageSummary[]
        }
        if (Array.isArray(data?.packages)) {
          return data.packages.slice(0, limit)
        }
      }
    } catch {
      // Network failure or unreachable; fall back to built-in registry
    }
  }

  // Fallback to built-in packages
  const builtinSummaries = getBuiltinPackageSummaries()
  const cleanQuery = query.trim().toLowerCase()

  if (!cleanQuery || cleanQuery === "*") {
    return builtinSummaries.slice(0, limit)
  }

  const filtered = builtinSummaries.filter((pkg) => {
    return (
      pkg.name.toLowerCase().includes(cleanQuery) ||
      pkg.namespace.toLowerCase().includes(cleanQuery) ||
      pkg.package_ref.toLowerCase().includes(cleanQuery) ||
      pkg.title.toLowerCase().includes(cleanQuery) ||
      pkg.description.toLowerCase().includes(cleanQuery) ||
      pkg.tags?.some((t) => t.toLowerCase().includes(cleanQuery))
    )
  })

  return filtered.slice(0, limit)
}

/**
 * Inspect an ohi.dev package publication and return its metadata, dependencies, and artifacts.
 * Falls back to built-in deterministic publications when offline or unreachable.
 *
 * @throws {OhiPackageNotFoundError} If the package cannot be found.
 */
export async function inspectOhiPublication(
  ontologyRef: string,
  options?: InspectOhiOptions
): Promise<OhiPublicationMetadata> {
  const catalogUrl = options?.catalogUrl || "https://ohi.dev"
  const cleanRef = ontologyRef.trim()
  const isOffline =
    options?.offlineOnly ||
    process.env.OFFLINE_MODE === "true" ||
    catalogUrl.startsWith("mock://offline")

  // Attempt live HTTP inspection
  if (!isOffline && catalogUrl) {
    try {
      const inspectEndpoint = `${catalogUrl.replace(/\/+$/, "")}/api/v1/publications/${encodeURIComponent(cleanRef)}`
      const response = await fetch(inspectEndpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        const metadata = (await response.json()) as OhiPublicationMetadata
        if (metadata && metadata.package_ref) {
          return metadata
        }
      }
    } catch {
      // Network failure or unreachable; fall back to built-in registry
    }
  }

  // Fallback to built-in registry
  const builtin = getBuiltinPublication(cleanRef)
  if (!builtin) {
    throw new OhiPackageNotFoundError(cleanRef)
  }

  const meta = { ...builtin.metadata }

  // Adjust release URL and artifact URLs if catalogUrl is customized
  if (catalogUrl !== "https://ohi.dev") {
    meta.release_url = normalizeCatalogUrl(meta.release_url, catalogUrl)
    const adjustedArtifacts: Partial<Record<OhiFormat, OhiArtifactDescriptor>> =
      {}
    for (const [fmt, art] of Object.entries(meta.artifacts)) {
      if (art) {
        adjustedArtifacts[fmt as OhiFormat] = {
          ...art,
          url: normalizeCatalogUrl(art.url, catalogUrl),
        }
      }
    }
    meta.artifacts = adjustedArtifacts
  }

  return meta
}

/**
 * Resolves the full transitive dependency tree for an OhiManifest.
 * Populates selections, deduplicated locked files with SHA-256 digests, and an artifacts Map.
 *
 * Handles:
 * - Direct vs transitive dependencies
 * - Deduplication of shared transitive packages
 * - Diamond versioning across distinct package paths
 * - Target format mapping (linkml-yaml vs owl-turtle)
 * - Deterministic fallback for air-gapped / offline operation
 */
export async function resolveOhiDependencyTree(
  manifest: OhiManifest,
  options?: ResolveOhiOptions
): Promise<{ lockfile: OhiLockfileV2; artifacts: Map<string, string> }> {
  const catalogUrl = options?.catalogUrl || "https://ohi.dev"
  const offlineOnly = options?.offlineOnly ?? false
  const downloadDir = (manifest.download_dir || ".ohi")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
  const defaultFormat = manifest.default_format || "owl-turtle"

  const selections: OhiLockSelection[] = []
  const files: OhiLockedFile[] = []
  const artifacts = new Map<string, string>()

  // Deduplication key: `${namespace}/${name}@${version}:${format}`
  const visitedFiles = new Set<string>()

  // Step 1: Process direct dependencies and record selections
  for (const dep of manifest.dependencies) {
    const pub = await inspectOhiPublication(dep.ontology, {
      catalogUrl,
      offlineOnly,
    })
    const targetFormat = dep.format || defaultFormat
    const artifactDescriptor =
      pub.artifacts[targetFormat] ||
      pub.artifacts[defaultFormat] ||
      pub.artifacts["owl-turtle"] ||
      pub.artifacts["linkml-yaml"]

    selections.push({
      ontology: dep.ontology,
      release_url: pub.release_url,
      artifact_url: artifactDescriptor
        ? normalizeCatalogUrl(artifactDescriptor.url, catalogUrl)
        : undefined,
      format: targetFormat,
    })
  }

  // Step 2: Transitive traversal using BFS queue
  const queue: Array<{ ontology: string; format?: OhiFormat }> =
    manifest.dependencies.map((d) => ({
      ontology: d.ontology,
      format: d.format || defaultFormat,
    }))

  while (queue.length > 0) {
    const current = queue.shift()!
    const pub = await inspectOhiPublication(current.ontology, {
      catalogUrl,
      offlineOnly,
    })
    const targetFormat = current.format || defaultFormat

    const fileDedupeKey = `${pub.namespace}/${pub.name}@${pub.version}:${targetFormat}`
    if (visitedFiles.has(fileDedupeKey)) {
      continue
    }
    visitedFiles.add(fileDedupeKey)

    // Select artifact descriptor
    const descriptor =
      pub.artifacts[targetFormat] ||
      pub.artifacts[defaultFormat] ||
      pub.artifacts["owl-turtle"] ||
      pub.artifacts["linkml-yaml"]

    if (!descriptor) {
      throw new Error(
        `No compatible artifact descriptor available for ${pub.package_ref} (${targetFormat})`
      )
    }

    // Retrieve artifact content
    let content = descriptor.content
    if (!content) {
      const builtin = getBuiltinPublication(pub.package_ref)
      content = builtin?.artifacts[descriptor.format]?.content
      if (!content && !offlineOnly) {
        try {
          const res = await fetch(descriptor.url, {
            signal: AbortSignal.timeout(1000),
          })
          if (res.ok) {
            content = await res.text()
          }
        } catch {
          // ignore network failure; will fallback
        }
      }
    }

    if (!content) {
      throw new Error(
        `Unable to load artifact content for ${pub.package_ref} (${descriptor.format})`
      )
    }

    const actualSha256 = computeSha256(content)
    if (descriptor.sha256 && descriptor.sha256 !== actualSha256) {
      throw new Error(
        `Artifact checksum mismatch for ${pub.package_ref} (${descriptor.format}): expected ${descriptor.sha256}, got ${actualSha256}`
      )
    }

    const fileExt = FORMAT_EXTENSIONS[descriptor.format] || "owl.ttl"
    const rawFileName =
      descriptor.package_path.split("/").pop() || `${pub.name}.${fileExt}`
    const package_path = `${downloadDir}/${pub.namespace}/${pub.name}/${pub.version}/${rawFileName}`
    const fileUrl = normalizeCatalogUrl(descriptor.url, catalogUrl)

    const lockedFile: OhiLockedFile = {
      package_path,
      path: package_path,
      base_url: pub.base_url,
      url: fileUrl,
      format: descriptor.format,
      sha256: actualSha256,
      ontology: pub.package_ref,
    }

    files.push(lockedFile)
    artifacts.set(package_path, content)
    artifacts.set(fileUrl, content)

    // Enqueue transitive dependencies
    for (const childDep of pub.dependencies) {
      queue.push({
        ontology: childDep.ontology,
        format: childDep.format || targetFormat,
      })
    }
  }

  const lockfile: OhiLockfileV2 = {
    lock_version: 2,
    selections,
    files,
  }

  return { lockfile, artifacts }
}
