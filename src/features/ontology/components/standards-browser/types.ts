import type { OhiPublicationMetadata } from "@/features/ontology/server/ohi/builtin-publications"
import type { OhiLockVerificationReport } from "@/features/ontology/server/ohi/lockfile-verifier"
import type {
  OhiFormat,
  OhiLockfileV2,
  OhiManifest,
} from "@/features/ontology/server/ohi/types"

export type OhiLockStatus = "empty" | "verified" | "drifted" | "unlocked"

export type StandardsSubView = "packages" | "terms"

export interface OhiInstalledPackageItem {
  packageRef: string
  namespace: string
  name: string
  version: string
  isDirect: boolean
  format: OhiFormat
  sha256: string
  verified: boolean
  mismatchReason: "tampered" | "missing" | null
  baseUrl: string
  packagePath: string
  url: string
  referenceOntologyId?: string
}

export interface OhiPackageState {
  ontologyId: string
  manifest: OhiManifest
  lockfile: OhiLockfileV2 | null
  verification: OhiLockVerificationReport
  status: OhiLockStatus
  packages: OhiInstalledPackageItem[]
}

export interface OhiDependencyNode {
  packageRef: string
  namespace: string
  name: string
  version: string
  isDirect: boolean
  format: OhiFormat
  sha256: string
  baseUrl: string
  packagePath: string
  url: string
}

export interface OhiPackageTreePreview {
  publication: OhiPublicationMetadata
  selectedFormat: OhiFormat
  lockfile: OhiLockfileV2
  directPackages: OhiDependencyNode[]
  transitivePackages: OhiDependencyNode[]
}
