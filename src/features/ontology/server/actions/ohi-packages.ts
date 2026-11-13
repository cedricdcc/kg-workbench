"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import { ontologyDocuments, referenceOntologies } from "@/server/db/schema"
import {
  assertOntologyDocumentAccess,
  getCurrentGroupKeyOrThrow,
} from "@/server/group-access"
import type {
  OhiPackageState,
  OhiPackageTreePreview,
} from "@/features/ontology/components/standards-browser/types"
import type { OhiPackageSummary } from "@/features/ontology/server/ohi/builtin-publications"
import {
  inspectOhiPublication,
  searchOhiPackages,
  type ResolveOhiOptions,
  type SearchOhiOptions,
} from "@/features/ontology/server/ohi/catalog-client"
import { findArtifactContent } from "@/features/ontology/server/ohi/lockfile-verifier"
import { serializeOhiYaml } from "@/features/ontology/server/ohi/manifest"
import {
  addDependencyToManifest,
  buildOhiPackageState,
  buildOhiTreePreview,
  parsePackageRefParts,
  removeDependencyFromManifest,
  resolveAndSyncOhiManifest,
  safeParseOhiManifest,
} from "@/features/ontology/server/ohi/package-manager"
import type {
  OhiFormat,
  OhiLockfileV2,
  OhiManifest,
} from "@/features/ontology/server/ohi/types"
import { syncReferenceOntology } from "./reference-vocabularies"

async function loadDocumentOhiContext(ontologyId: string) {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const [doc] = await db
    .select({
      id: ontologyDocuments.id,
      ohi_yaml: ontologyDocuments.ohi_yaml,
      ohi_lockfile: ontologyDocuments.ohi_lockfile,
    })
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, ontologyId))
    .limit(1)

  if (!doc) {
    throw new Error(`Ontology document not found: ${ontologyId}`)
  }

  const refRows = await db
    .select()
    .from(referenceOntologies)
    .where(
      and(
        eq(referenceOntologies.ontology_id, ontologyId),
        eq(referenceOntologies.source_registry, "ohi")
      )
    )

  const storedArtifacts = new Map<string, string>()
  const referenceIdBySourceId = new Map<string, string>()

  for (const row of refRows) {
    referenceIdBySourceId.set(row.source_id, row.id)
    if (row.artifact_content) {
      if (row.artifact_url) {
        storedArtifacts.set(row.artifact_url, row.artifact_content)
      }
      if (row.source_id) {
        storedArtifacts.set(row.source_id, row.artifact_content)
        const parts = parsePackageRefParts(row.source_id)
        const matchingFile = doc.ohi_lockfile?.files.find(
          (f) => f.ontology === row.source_id || f.url === row.artifact_url
        )
        if (matchingFile?.package_path) {
          storedArtifacts.set(matchingFile.package_path, row.artifact_content)
        }
        if (matchingFile?.path) {
          storedArtifacts.set(matchingFile.path, row.artifact_content)
        }
        if (parts.name) {
          storedArtifacts.set(
            `${parts.namespace}/${parts.name}`,
            row.artifact_content
          )
        }
      }
    }
  }

  return {
    db,
    groupKey,
    doc,
    refRows,
    storedArtifacts,
    referenceIdBySourceId,
  }
}

async function persistOhiStateToDatabase(input: {
  ontologyId: string
  manifest: OhiManifest
  lockfile: OhiLockfileV2
  artifacts: Map<string, string>
  offlineOnly?: boolean
}): Promise<OhiPackageState> {
  const { db, groupKey, refRows } = await loadDocumentOhiContext(
    input.ontologyId
  )
  const serializedYaml = serializeOhiYaml(input.manifest)

  await db
    .update(ontologyDocuments)
    .set({
      ohi_yaml: serializedYaml,
      ohi_lockfile: input.lockfile,
    })
    .where(eq(ontologyDocuments.id, input.ontologyId))

  const directSet = new Set(
    input.manifest.dependencies.map((d) => d.ontology.trim().toLowerCase())
  )
  const existingBySourceId = new Map(refRows.map((r) => [r.source_id, r]))
  const activeSourceIds = new Set<string>()
  const referenceIdBySourceId = new Map<string, string>()
  const syncedRefIds: string[] = []

  for (const file of input.lockfile.files) {
    const packageRef =
      file.ontology ||
      (() => {
        const p = parsePackageRefParts("", file.package_path)
        return p.version
          ? `${p.namespace}/${p.name}@${p.version}`
          : `${p.namespace}/${p.name}`
      })()

    activeSourceIds.add(packageRef)
    const parts = parsePackageRefParts(packageRef, file.package_path)
    const isDirect = directSet.has(packageRef.trim().toLowerCase())
    const content = findArtifactContent(input.artifacts, file) ?? ""

    let title = parts.name.toUpperCase()
    let releaseUrl = ""
    try {
      const pub = await inspectOhiPublication(packageRef, {
        offlineOnly: input.offlineOnly,
      })
      title = pub.title || title
      releaseUrl = pub.release_url || ""
    } catch {
      // Keep fallback title
    }

    const existing = existingBySourceId.get(packageRef)
    if (existing) {
      await db
        .update(referenceOntologies)
        .set({
          name: title,
          base_iri: file.base_url,
          version: parts.version,
          publication_url: releaseUrl || existing.publication_url,
          artifact_url: file.url,
          artifact_format: file.format,
          sha256: file.sha256,
          artifact_content: content,
          is_transitive: !isDirect,
          synced_at: new Date().toISOString(),
        })
        .where(eq(referenceOntologies.id, existing.id))
      referenceIdBySourceId.set(packageRef, existing.id)
      syncedRefIds.push(existing.id)
    } else {
      const [inserted] = await db
        .insert(referenceOntologies)
        .values({
          ontology_id: input.ontologyId,
          prefix: parts.name.toLowerCase(),
          name: title,
          base_iri: file.base_url,
          source_registry: "ohi",
          source_id: packageRef,
          version: parts.version,
          publication_url: releaseUrl || null,
          artifact_url: file.url,
          artifact_format: file.format,
          sha256: file.sha256,
          artifact_content: content,
          is_transitive: !isDirect,
          group_key: groupKey,
        })
        .returning({ id: referenceOntologies.id })

      if (inserted) {
        referenceIdBySourceId.set(packageRef, inserted.id)
        syncedRefIds.push(inserted.id)
      }
    }
  }

  // Remove orphaned ohi reference ontologies no longer in lockfile
  for (const row of refRows) {
    if (!activeSourceIds.has(row.source_id)) {
      await db
        .delete(referenceOntologies)
        .where(eq(referenceOntologies.id, row.id))
    }
  }

  // Best-effort term indexing for each synced reference ontology
  for (const refId of syncedRefIds) {
    try {
      await syncReferenceOntology(refId)
    } catch {
      // Term indexing failure should not fail lockfile synchronization
    }
  }

  revalidatePath(routes.ontology.document(input.ontologyId), "layout")
  revalidatePath(routes.ontology.root, "layout")

  return buildOhiPackageState({
    ontologyId: input.ontologyId,
    ohiYaml: serializedYaml,
    lockfile: input.lockfile,
    storedArtifacts: input.artifacts,
    referenceIdBySourceId,
  })
}

export async function getOhiPackageStateAction(
  ontologyId: string
): Promise<OhiPackageState> {
  const { doc, storedArtifacts, referenceIdBySourceId } =
    await loadDocumentOhiContext(ontologyId)

  return buildOhiPackageState({
    ontologyId,
    ohiYaml: doc.ohi_yaml,
    lockfile: doc.ohi_lockfile,
    storedArtifacts,
    referenceIdBySourceId,
  })
}

export async function searchOhiCatalogAction(
  query: string,
  options?: SearchOhiOptions
): Promise<OhiPackageSummary[]> {
  return searchOhiPackages(query, options)
}

export async function inspectOhiPackageTreeAction(
  packageRef: string,
  format: OhiFormat = "linkml-yaml",
  options?: ResolveOhiOptions
): Promise<OhiPackageTreePreview> {
  return buildOhiTreePreview(packageRef, format, options)
}

export async function addOhiPackageAction(input: {
  ontologyId: string
  packageRef: string
  format?: OhiFormat
  offlineOnly?: boolean
}): Promise<OhiPackageState> {
  const { doc } = await loadDocumentOhiContext(input.ontologyId)
  const currentManifest = safeParseOhiManifest(doc.ohi_yaml)
  const nextManifest = addDependencyToManifest(currentManifest, {
    ontology: input.packageRef,
    format: input.format ?? currentManifest.default_format,
  })

  const { lockfile, artifacts } = await resolveAndSyncOhiManifest(nextManifest, {
    offlineOnly: input.offlineOnly,
  })

  return persistOhiStateToDatabase({
    ontologyId: input.ontologyId,
    manifest: nextManifest,
    lockfile,
    artifacts,
    offlineOnly: input.offlineOnly,
  })
}

export async function syncOhiLockfileAction(
  ontologyId: string,
  options?: ResolveOhiOptions
): Promise<OhiPackageState> {
  const { doc } = await loadDocumentOhiContext(ontologyId)
  const manifest = safeParseOhiManifest(doc.ohi_yaml)
  const { lockfile, artifacts } = await resolveAndSyncOhiManifest(
    manifest,
    options
  )

  return persistOhiStateToDatabase({
    ontologyId,
    manifest,
    lockfile,
    artifacts,
    offlineOnly: options?.offlineOnly,
  })
}

export async function removeOhiPackageAction(input: {
  ontologyId: string
  packageRef: string
  offlineOnly?: boolean
}): Promise<OhiPackageState> {
  const { doc } = await loadDocumentOhiContext(input.ontologyId)
  const currentManifest = safeParseOhiManifest(doc.ohi_yaml)
  const nextManifest = removeDependencyFromManifest(
    currentManifest,
    input.packageRef
  )

  const { lockfile, artifacts } = await resolveAndSyncOhiManifest(nextManifest, {
    offlineOnly: input.offlineOnly,
  })

  return persistOhiStateToDatabase({
    ontologyId: input.ontologyId,
    manifest: nextManifest,
    lockfile,
    artifacts,
    offlineOnly: input.offlineOnly,
  })
}
