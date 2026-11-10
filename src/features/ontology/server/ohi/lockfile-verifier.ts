import { computeSha256 } from "./manifest"
import type { OhiLockedFile, OhiLockfileV2 } from "./types"

export type OhiMismatchReason = "tampered" | "missing"

export interface OhiLockVerificationMismatch {
  path: string
  expected_sha256: string
  actual_sha256?: string
  reason: OhiMismatchReason
  url?: string
  ontology?: string
}

export interface OhiLockVerificationReport {
  valid: boolean
  checked_files_count: number
  mismatched_files: OhiLockVerificationMismatch[]
}

/**
 * Custom error thrown when ohi.lock.json verification detects tampering or missing artifacts.
 */
export class OhiLockfileDriftError extends Error {
  public readonly report: OhiLockVerificationReport

  constructor(report: OhiLockVerificationReport, message?: string) {
    const tamperedCount = report.mismatched_files.filter(
      (m) => m.reason === "tampered"
    ).length
    const missingCount = report.mismatched_files.filter(
      (m) => m.reason === "missing"
    ).length
    const defaultMsg = `Ohi lockfile verification failed: ${report.mismatched_files.length} mismatched file(s) (${tamperedCount} tampered, ${missingCount} missing)`
    super(message || defaultMsg)
    this.name = "OhiLockfileDriftError"
    this.report = report
  }
}

/**
 * Searches stored artifacts for a given locked file using package_path, path, or url.
 */
export function findArtifactContent(
  storedArtifacts: Record<string, string> | Map<string, string>,
  file: OhiLockedFile
): string | undefined {
  const isMap = storedArtifacts instanceof Map
  const normPkg = file.package_path
    ? file.package_path.replace(/\\/g, "/")
    : undefined
  const normPath = file.path ? file.path.replace(/\\/g, "/") : undefined

  const candidateKeys = [
    file.package_path,
    file.path,
    file.url,
    normPkg,
    normPath,
    normPkg ? normPkg.replace(/^\.?\/?\.?ohi\//, "") : undefined,
    normPkg ? normPkg.split("/").pop() : undefined,
    normPath ? normPath.split("/").pop() : undefined,
  ].filter((k): k is string => Boolean(k && k.length > 0))

  for (const key of candidateKeys) {
    if (isMap) {
      if (storedArtifacts.has(key)) {
        return storedArtifacts.get(key)
      }
    } else if (Object.prototype.hasOwnProperty.call(storedArtifacts, key)) {
      return storedArtifacts[key]
    }
  }

  return undefined
}

/**
 * Verifies that all files declared in ohi.lock.json match the SHA-256 digests
 * of stored artifacts. Flags tampered or missing artifacts.
 *
 * @param lockfile Parsed ohi.lock.json v2 structure
 * @param storedArtifacts Map or Record of stored artifact content indexed by package_path, path, or url
 * @returns Verification report detailing checked file counts and any mismatches
 */
export function verifyOhiLockfileArtifacts(
  lockfile: OhiLockfileV2,
  storedArtifacts: Record<string, string> | Map<string, string>
): OhiLockVerificationReport {
  const mismatched_files: OhiLockVerificationMismatch[] = []

  for (const file of lockfile.files) {
    const canonicalPath = file.package_path || file.path || file.url
    const content = findArtifactContent(storedArtifacts, file)

    if (content === undefined || content === null) {
      mismatched_files.push({
        path: canonicalPath,
        expected_sha256: file.sha256,
        reason: "missing",
        url: file.url,
        ...(file.ontology ? { ontology: file.ontology } : {}),
      })
      continue
    }

    const actualSha256 = computeSha256(content)
    if (actualSha256 !== file.sha256) {
      mismatched_files.push({
        path: canonicalPath,
        expected_sha256: file.sha256,
        actual_sha256: actualSha256,
        reason: "tampered",
        url: file.url,
        ...(file.ontology ? { ontology: file.ontology } : {}),
      })
    }
  }

  return {
    valid: mismatched_files.length === 0,
    checked_files_count: lockfile.files.length,
    mismatched_files,
  }
}

/**
 * Asserts the integrity of an ohi.lock.json lockfile against stored artifacts.
 * Throws OhiLockfileDriftError if any artifact is missing or tampered with.
 *
 * @throws {OhiLockfileDriftError} If lockfile verification fails
 */
export function assertOhiLockfileIntegrity(
  lockfile: OhiLockfileV2,
  storedArtifacts: Record<string, string> | Map<string, string>
): void {
  const report = verifyOhiLockfileArtifacts(lockfile, storedArtifacts)
  if (!report.valid) {
    throw new OhiLockfileDriftError(report)
  }
}
