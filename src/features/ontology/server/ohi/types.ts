import { z } from "zod"

/**
 * Supported artifact formats in ohi.dev package ecosystem.
 */
export const OHI_FORMATS = [
  "owl-turtle",
  "owl-rdfxml",
  "rdfs-turtle",
  "linkml-yaml",
  "ossie-yaml",
] as const

export type OhiFormat = (typeof OHI_FORMATS)[number]

export const OhiFormatSchema = z.enum([
  "owl-turtle",
  "owl-rdfxml",
  "rdfs-turtle",
  "linkml-yaml",
  "ossie-yaml",
])

/**
 * Dependency reference in ohi.yaml manifest.
 * Format is optional; defaults to manifest.default_format if omitted.
 */
export interface OhiDependencyRef {
  ontology: string
  format?: OhiFormat
}

export const OhiDependencyRefSchema = z.object({
  ontology: z.string().min(1, "ontology package reference is required"),
  format: OhiFormatSchema.optional(),
})

/**
 * Canonical ohi.yaml package manifest structure.
 */
export interface OhiManifest {
  format_version: number
  default_format: OhiFormat
  download_dir: string
  dependencies: OhiDependencyRef[]
}

export const OhiManifestSchema = z.object({
  format_version: z.number().int().default(1),
  default_format: OhiFormatSchema.default("owl-turtle"),
  download_dir: z.string().default(".ohi"),
  dependencies: z
    .preprocess(
      (val) => (val === null || val === undefined ? [] : val),
      z.array(OhiDependencyRefSchema)
    )
    .default([]),
})

/**
 * Selected top-level package in ohi.lock.json v2.
 */
export interface OhiLockSelection {
  ontology: string
  release_url?: string
  artifact_url?: string
  format?: OhiFormat
}

export const OhiLockSelectionSchema = z.object({
  ontology: z.string().min(1, "ontology package reference is required"),
  release_url: z.string().optional(),
  artifact_url: z.string().optional(),
  format: OhiFormatSchema.optional(),
})

/**
 * Locked artifact file in ohi.lock.json v2.
 * Supports both package_path and path seamlessly for compatibility.
 */
export interface OhiLockedFile {
  package_path: string
  base_url: string
  url: string
  format: OhiFormat
  sha256: string
  ontology?: string
  path?: string
}

export const OhiLockedFileSchema = z
  .object({
    package_path: z.string().optional(),
    path: z.string().optional(),
    ontology: z.string().optional(),
    base_url: z.string().min(1, "base_url is required"),
    url: z.string().min(1, "url is required"),
    format: OhiFormatSchema,
    sha256: z.string().min(1, "sha256 checksum is required"),
  })
  .refine((file) => Boolean(file.package_path || file.path), {
    message: "Either package_path or path must be specified",
    path: ["package_path"],
  })
  .transform((file): OhiLockedFile => {
    const canonicalPath = file.package_path || file.path || ""
    return {
      package_path: canonicalPath,
      path: file.path || canonicalPath,
      base_url: file.base_url,
      url: file.url,
      format: file.format,
      sha256: file.sha256,
      ...(file.ontology ? { ontology: file.ontology } : {}),
    }
  })

/**
 * Canonical ohi.lock.json v2 lockfile structure.
 */
export interface OhiLockfileV2 {
  lock_version: 2
  selections: OhiLockSelection[]
  files: OhiLockedFile[]
}

export const OhiLockfileV2Schema = z.object({
  lock_version: z.literal(2),
  selections: z
    .preprocess(
      (val) => (val === null || val === undefined ? [] : val),
      z.array(OhiLockSelectionSchema)
    )
    .default([]),
  files: z
    .preprocess(
      (val) => (val === null || val === undefined ? [] : val),
      z.array(OhiLockedFileSchema)
    )
    .default([]),
})
