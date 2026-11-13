import type {
  OhiDependencyNode,
  OhiInstalledPackageItem,
  OhiLockStatus,
  OhiPackageState,
  OhiPackageTreePreview,
} from "@/features/ontology/components/standards-browser/types"
import {
  inspectOhiPublication,
  resolveOhiDependencyTree,
  type ResolveOhiOptions,
} from "./catalog-client"
import {
  verifyOhiLockfileArtifacts,
  type OhiLockVerificationReport,
} from "./lockfile-verifier"
import { parseOhiYaml } from "./manifest"
import type {
  OhiDependencyRef,
  OhiFormat,
  OhiLockedFile,
  OhiLockfileV2,
  OhiManifest,
} from "./types"

export function createEmptyOhiManifest(
  defaultFormat: OhiFormat = "linkml-yaml"
): OhiManifest {
  return {
    format_version: 1,
    default_format: defaultFormat,
    download_dir: ".ohi",
    dependencies: [],
  }
}

export function safeParseOhiManifest(ohiYaml: string): OhiManifest {
  if (!ohiYaml || !ohiYaml.trim()) {
    return createEmptyOhiManifest()
  }
  try {
    return parseOhiYaml(ohiYaml)
  } catch {
    return createEmptyOhiManifest()
  }
}

export function parsePackageRefParts(
  packageRef: string,
  fallbackPath?: string
): { namespace: string; name: string; version: string } {
  const trimmed = packageRef.trim()
  if (trimmed.includes("/")) {
    const [ns, rest] = trimmed.split("/", 2)
    const [name, version = ""] = (rest ?? "").split("@", 2)
    return {
      namespace: ns || "ohi",
      name: name || trimmed,
      version,
    }
  }

  if (fallbackPath) {
    const normalized = fallbackPath.replace(/\\/g, "/").replace(/^\.?\/?\.?ohi\//, "")
    const segments = normalized.split("/").filter(Boolean)
    if (segments.length >= 3) {
      return {
        namespace: segments[0] ?? "ohi",
        name: segments[1] ?? trimmed,
        version: segments[2] ?? "",
      }
    }
  }

  const [name, version = ""] = trimmed.split("@", 2)
  return {
    namespace: "ohi",
    name: name || trimmed,
    version,
  }
}

function normalizeRefIdentity(ref: string): string {
  return ref.trim().toLowerCase()
}

export function addDependencyToManifest(
  manifest: OhiManifest,
  dep: OhiDependencyRef
): OhiManifest {
  const targetId = normalizeRefIdentity(dep.ontology)
  const existingIdx = manifest.dependencies.findIndex(
    (d) => normalizeRefIdentity(d.ontology) === targetId
  )
  const nextDeps = [...manifest.dependencies]
  const nextEntry: OhiDependencyRef = {
    ontology: dep.ontology.trim(),
    ...(dep.format ? { format: dep.format } : {}),
  }

  if (existingIdx >= 0) {
    nextDeps[existingIdx] = nextEntry
  } else {
    nextDeps.push(nextEntry)
  }

  return {
    ...manifest,
    dependencies: nextDeps,
  }
}

export function removeDependencyFromManifest(
  manifest: OhiManifest,
  packageRef: string
): OhiManifest {
  const targetId = normalizeRefIdentity(packageRef)
  return {
    ...manifest,
    dependencies: manifest.dependencies.filter(
      (d) => normalizeRefIdentity(d.ontology) !== targetId
    ),
  }
}

export async function resolveAndSyncOhiManifest(
  manifest: OhiManifest,
  options?: ResolveOhiOptions
): Promise<{ lockfile: OhiLockfileV2; artifacts: Map<string, string> }> {
  if (manifest.dependencies.length === 0) {
    return {
      lockfile: {
        lock_version: 2,
        selections: [],
        files: [],
      },
      artifacts: new Map<string, string>(),
    }
  }
  return resolveOhiDependencyTree(manifest, options)
}

export async function buildOhiTreePreview(
  packageRef: string,
  format: OhiFormat = "linkml-yaml",
  options?: ResolveOhiOptions
): Promise<OhiPackageTreePreview> {
  const publication = await inspectOhiPublication(packageRef, options)
  const manifest: OhiManifest = {
    format_version: 1,
    default_format: format,
    download_dir: ".ohi",
    dependencies: [{ ontology: publication.package_ref, format }],
  }

  const { lockfile } = await resolveOhiDependencyTree(manifest, options)
  const directRefs = new Set(
    lockfile.selections.map((s) => normalizeRefIdentity(s.ontology))
  )

  const directPackages: OhiDependencyNode[] = []
  const transitivePackages: OhiDependencyNode[] = []

  for (const file of lockfile.files) {
    const ref = file.ontology || publication.package_ref
    const parts = parsePackageRefParts(ref, file.package_path)
    const isDirect = directRefs.has(normalizeRefIdentity(ref))
    const node: OhiDependencyNode = {
      packageRef: ref,
      namespace: parts.namespace,
      name: parts.name,
      version: parts.version,
      isDirect,
      format: file.format,
      sha256: file.sha256,
      baseUrl: file.base_url,
      packagePath: file.package_path,
      url: file.url,
    }
    if (isDirect) {
      directPackages.push(node)
    } else {
      transitivePackages.push(node)
    }
  }

  return {
    publication,
    selectedFormat: format,
    lockfile,
    directPackages,
    transitivePackages,
  }
}

function buildFileToMismatchMap(
  report: OhiLockVerificationReport
): Map<string, "tampered" | "missing"> {
  const map = new Map<string, "tampered" | "missing">()
  for (const mismatch of report.mismatched_files) {
    map.set(mismatch.path, mismatch.reason)
    if (mismatch.ontology) {
      map.set(mismatch.ontology, mismatch.reason)
    }
  }
  return map
}

function resolveLockStatus(
  manifest: OhiManifest,
  lockfile: OhiLockfileV2 | null,
  verification: OhiLockVerificationReport
): OhiLockStatus {
  if (manifest.dependencies.length === 0 && (!lockfile || lockfile.files.length === 0)) {
    return "empty"
  }
  if (!lockfile || lockfile.files.length === 0) {
    return "unlocked"
  }
  return verification.valid ? "verified" : "drifted"
}

function toInstalledPackageItem(
  file: OhiLockedFile,
  directRefs: Set<string>,
  mismatchMap: Map<string, "tampered" | "missing">,
  referenceIdBySourceId?: Map<string, string>
): OhiInstalledPackageItem {
  const canonicalPath = file.package_path || file.path || file.url
  const packageRef =
    file.ontology ||
    (() => {
      const p = parsePackageRefParts("", canonicalPath)
      return p.version ? `${p.namespace}/${p.name}@${p.version}` : `${p.namespace}/${p.name}`
    })()
  const parts = parsePackageRefParts(packageRef, canonicalPath)
  const isDirect = directRefs.has(normalizeRefIdentity(packageRef))
  const mismatchReason =
    mismatchMap.get(canonicalPath) ?? mismatchMap.get(packageRef) ?? null

  return {
    packageRef,
    namespace: parts.namespace,
    name: parts.name,
    version: parts.version,
    isDirect,
    format: file.format,
    sha256: file.sha256,
    verified: mismatchReason === null,
    mismatchReason,
    baseUrl: file.base_url,
    packagePath: canonicalPath,
    url: file.url,
    referenceOntologyId:
      referenceIdBySourceId?.get(packageRef) ??
      referenceIdBySourceId?.get(`${parts.namespace}/${parts.name}`),
  }
}

export function buildOhiPackageState(input: {
  ontologyId: string
  ohiYaml: string
  lockfile: OhiLockfileV2 | null
  storedArtifacts: Record<string, string> | Map<string, string>
  referenceIdBySourceId?: Map<string, string>
}): OhiPackageState {
  const manifest = safeParseOhiManifest(input.ohiYaml)
  const lockfile = input.lockfile

  const verification: OhiLockVerificationReport = lockfile
    ? verifyOhiLockfileArtifacts(lockfile, input.storedArtifacts)
    : {
        valid: manifest.dependencies.length === 0,
        checked_files_count: 0,
        mismatched_files: [],
      }

  const status = resolveLockStatus(manifest, lockfile, verification)
  const directRefs = new Set<string>([
    ...manifest.dependencies.map((d) => normalizeRefIdentity(d.ontology)),
    ...(lockfile?.selections.map((s) => normalizeRefIdentity(s.ontology)) ?? []),
  ])
  const mismatchMap = buildFileToMismatchMap(verification)

  const packages: OhiInstalledPackageItem[] = (lockfile?.files ?? []).map((file) =>
    toInstalledPackageItem(
      file,
      directRefs,
      mismatchMap,
      input.referenceIdBySourceId
    )
  )

  return {
    ontologyId: input.ontologyId,
    manifest,
    lockfile,
    verification,
    status,
    packages,
  }
}
