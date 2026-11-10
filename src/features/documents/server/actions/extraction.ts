"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import type { Document } from "@/domain/documents"
import { routes } from "@/lib/routes"
import {
  assertDocumentRecordAccess,
  assertOntologyDocumentAccess,
  getCurrentGroupKeyOrThrow,
} from "@/server/group-access"
import {
  getConfiguredExternalBaseUrl,
  getExtractionResults,
  getExtractionStatus,
  normalizeExtractorBaseUrl,
  triggerExtraction,
} from "@/server/external/extraction-adapter"
import type {
  ExtractionFile,
  ExtractorBackend,
  ExternalExtractionRequest,
  ExternalExtractionOptions,
  InternalExtractionOptions,
  InternalExtractorProvider,
  InternalExtractionRequest,
} from "@/server/external/extraction-api"
import { getDb } from "@/server/database"
import { documents, extractionRuns } from "@/server/db/schema"
import { loadCanonicalOntology } from "@/features/ontology/server/linkml/document-store"
import { createStorageProvider } from "@/server/storage"
import { buildOntologyExportInternal } from "@/features/ontology/server/actions/ontology-transfer/build-ontology-export"
import {
  getOntologyClasses,
  getOntologyDocument,
  getOntologyRelations,
} from "@/features/ontology/server/queries"

import { persistExtractionResults } from "./extraction-results-persistence"

const INTERNAL_EXTRACTOR_PROVIDERS = ["openai", "anthropic", "ollama"] as const

function getInternalProvider(value: FormDataEntryValue | null) {
  if (
    typeof value === "string" &&
    INTERNAL_EXTRACTOR_PROVIDERS.includes(value as InternalExtractorProvider)
  ) {
    return value as InternalExtractorProvider
  }
  return "openai"
}

function toKgPropertyType(dataType: string): string {
  switch (dataType) {
    case "number":
      return "FLOAT"
    case "boolean":
      return "BOOLEAN"
    case "date":
      return "DATE"
    case "integer":
      return "INTEGER"
    default:
      return "STRING"
  }
}

function getExtractorBackend(value: string | null): ExtractorBackend {
  return value === "internal" ? "internal" : "external"
}

function getExternalRuntimeOptions({
  apiKey,
  baseUrl,
}: {
  apiKey?: string
  baseUrl?: string | null
}): ExternalExtractionOptions | undefined {
  if (!apiKey && !baseUrl) return undefined
  return {
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
  }
}

function getExternalApiKey(value?: { externalApiKey?: string }) {
  return value?.externalApiKey?.trim() || undefined
}

async function buildExtractionFile(file: File): Promise<ExtractionFile> {
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  return {
    name: file.name,
    contentType: file.type || "application/octet-stream",
    base64: fileBuffer.toString("base64"),
  }
}

async function buildInternalExtractionOptions({
  db,
  ontologyId,
  classIds,
  relationIds,
  file,
  provider,
  apiKey,
}: {
  db: ReturnType<typeof getDb>
  ontologyId: string
  classIds?: string[]
  relationIds?: string[]
  file: File
  provider: InternalExtractorProvider
  apiKey?: string
}): Promise<InternalExtractionOptions> {
  if (provider !== "ollama" && !apiKey) {
    throw new Error("An API key is required for the selected provider.")
  }

  const snapshot = await loadCanonicalOntology(ontologyId, db)

  const selectedClassIds = classIds?.length ? new Set(classIds) : null
  const selectedRelationIds = relationIds?.length ? new Set(relationIds) : null

  const classes = (snapshot.classes ?? [])
    .filter(
      (c) =>
        !selectedClassIds ||
        selectedClassIds.has(c.id) ||
        selectedClassIds.has(c.name)
    )
    .map((c) => ({
      id: c.id,
      ontology_id: ontologyId,
      name: c.name,
      description: c.description ?? "",
      parent_class_id: c.parent_class_id ?? null,
      module_id: c.module_id ?? null,
      instance_policy: c.instance_policy ?? "open",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const relations = (snapshot.relations ?? [])
    .filter(
      (r) =>
        !selectedRelationIds ||
        selectedRelationIds.has(r.id) ||
        selectedRelationIds.has(r.name)
    )
    .map((r) => ({
      id: r.id,
      ontology_id: ontologyId,
      name: r.name,
      domain_class_id: r.domain_class_id,
      range_class_id: r.range_class_id,
      description: r.description ?? "",
      inverse_name: r.inverse_name ?? null,
      cardinality: r.cardinality ?? null,
      instance_policy: r.instance_policy ?? "open",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const classKeySet = new Set(classes.map((c) => c.id))
  const attributes = (snapshot.attributes ?? [])
    .filter((a) => classKeySet.has(a.class_id))
    .map((a) => ({
      id: a.id,
      class_id: a.class_id,
      name: a.name,
      data_type: a.data_type ?? "string",
      required: a.required ?? false,
      description: a.description ?? "",
    }))

  const attributesByClassId = new Map<string, typeof attributes>()
  for (const attribute of attributes) {
    const classAttributes = attributesByClassId.get(attribute.class_id) ?? []
    classAttributes.push(attribute)
    attributesByClassId.set(attribute.class_id, classAttributes)
  }

  const classById = new Map(classes.map((cls) => [cls.id, cls]))
  const usableRelations = relations.filter(
    (relation) =>
      classById.has(relation.domain_class_id) &&
      classById.has(relation.range_class_id)
  )

  const extractionFile = await buildExtractionFile(file)

  return {
    provider,
    ...(provider === "ollama" ? {} : { apiKey }),
    file: extractionFile,
    schema: {
      nodeTypes: classes.map((cls) => ({
        label: cls.name,
        description: cls.description || undefined,
        properties: (attributesByClassId.get(cls.id) ?? []).map(
          (attribute) => ({
            name: attribute.name,
            type: toKgPropertyType(attribute.data_type),
            description: attribute.description || undefined,
            required: attribute.required ?? false,
          })
        ),
      })),
      relationshipTypes: usableRelations.map((relation) => ({
        label: relation.name,
        description: relation.description || undefined,
      })),
      patterns: usableRelations.map((relation) => [
        classById.get(relation.domain_class_id)?.name ?? "",
        relation.name,
        classById.get(relation.range_class_id)?.name ?? "",
      ]),
    },
  }
}

async function buildExternalExtractionRequest({
  documentId,
  runId,
  ontologyId,
  file,
  exportLanguage,
  missingTranslationBehavior,
}: {
  documentId: string
  runId: string
  ontologyId: string
  file: File
  exportLanguage: string
  missingTranslationBehavior: "fallback" | "strict"
}): Promise<ExternalExtractionRequest> {
  const [document, classes, relations] = await Promise.all([
    getOntologyDocument(ontologyId),
    getOntologyClasses(ontologyId),
    getOntologyRelations(ontologyId),
  ])
  const [extractionFile, ontologyExport] = await Promise.all([
    buildExtractionFile(file),
    buildOntologyExportInternal({
      ontologyId,
      exportLanguage,
      missingTranslationBehavior,
      moduleIds: document.modules.map((ontologyModule) => ontologyModule.id),
      classIds: classes.map((cls) => cls.id),
      relationIds: relations.map((relation) => relation.id),
      includeVisual: false,
    }),
  ])

  return {
    runId,
    documentId,
    ontologyId,
    file: extractionFile,
    ontology: ontologyExport.payload,
  }
}

/**
 * Creates a document record, optionally retains the original file, creates an
 * extraction run, and triggers the selected extraction backend. The document
 * is immediately set to "processing" status.
 */
export async function uploadDocumentAndExtract(
  formData: FormData
): Promise<{ document: Document; runId: string }> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow()
  const title = formData.get("title") as string
  const ontologyId = formData.get("ontologyId") as string
  const language = (formData.get("language") as string | null) ?? undefined
  const missingTranslationBehavior =
    formData.get("missingTranslationBehavior") === "strict"
      ? "strict"
      : "fallback"
  const classIds = formData.get("classIds")
    ? (JSON.parse(formData.get("classIds") as string) as string[])
    : undefined
  const relationIds = formData.get("relationIds")
    ? (JSON.parse(formData.get("relationIds") as string) as string[])
    : undefined
  const extractorBackend = getExtractorBackend(
    (formData.get("extractorBackend") as string | null) ?? null
  )
  const internalProvider = getInternalProvider(formData.get("internalProvider"))
  const modelName = (formData.get("modelName") as string | null)?.trim() ?? ""
  const internalApiKey =
    internalProvider === "ollama"
      ? undefined
      : ((formData.get("internalApiKey") as string | null)?.trim() ?? undefined)
  const externalUrlInput =
    (formData.get("externalUrl") as string | null)?.trim() ?? ""
  const externalApiKey =
    (formData.get("externalApiKey") as string | null)?.trim() ?? undefined
  const externalExtractorUrl =
    extractorBackend === "external"
      ? externalUrlInput
        ? normalizeExtractorBaseUrl(externalUrlInput)
        : getConfiguredExternalBaseUrl()
      : null
  const file = formData.get("file") as File | null
  await assertOntologyDocumentAccess(ontologyId, db)
  if (!file || file.size === 0) throw new Error("A file is required.")
  if (extractorBackend === "internal" && !modelName) {
    throw new Error("A model name is required.")
  }
  if (
    extractorBackend === "internal" &&
    internalProvider !== "ollama" &&
    !internalApiKey
  ) {
    throw new Error("An API key is required for the selected provider.")
  }

  const [doc] = await db
    .insert(documents)
    .values({
      title,
      language: "en",
      page_count: 0,
      excerpt: "",
      status: "processing",
      group_key: groupKey,
    })
    .returning()
  if (!doc) throw new Error("Failed to create document.")

  const storage = createStorageProvider()
  if (storage.persistsFiles) {
    const path = `${doc.id}/${file.name}`
    await storage.retainDocument(path, file)

    const [updated] = await db
      .update(documents)
      .set({ file_path: path })
      .where(eq(documents.id, doc.id))
      .returning()
    if (!updated) throw new Error("Document was not found.")

    Object.assign(doc, updated)
  }

  const [run] = await db
    .insert(extractionRuns)
    .values({
      document_id: doc.id,
      group_key: groupKey,
      ontology_id: ontologyId,
      status: "pending",
      started_at: new Date().toISOString(),
      extractor_backend: extractorBackend,
      internal_provider:
        extractorBackend === "internal" ? internalProvider : null,
      internal_model_name: extractorBackend === "internal" ? modelName : null,
      external_extractor_url: externalExtractorUrl,
    })
    .returning()
  if (!run) throw new Error("Failed to create extraction run.")

  try {
    const internalRequest: InternalExtractionRequest = {
      documentId: run.id,
      ontologyId,
      modelName,
    }

    if (extractorBackend === "internal") {
      await triggerExtraction(internalRequest, extractorBackend, {
        internal: await buildInternalExtractionOptions({
          db,
          ontologyId,
          classIds,
          relationIds,
          file,
          provider: internalProvider,
          apiKey: internalApiKey,
        }),
      })
    } else {
      await triggerExtraction(
        await buildExternalExtractionRequest({
          documentId: doc.id,
          runId: run.id,
          ontologyId,
          file,
          exportLanguage: language ?? "en",
          missingTranslationBehavior,
        }),
        extractorBackend,
        {
          external: getExternalRuntimeOptions({
            apiKey: externalApiKey,
            baseUrl: externalExtractorUrl,
          }),
        }
      )
    }
  } catch (error) {
    await db
      .update(extractionRuns)
      .set({ status: "failed" })
      .where(eq(extractionRuns.id, run.id))
    throw error
  }

  revalidatePath(routes.knowledgeGraph.root)
  return { document: doc as Document, runId: run.id }
}

export async function pollExtractionStatus(
  runId: string,
  options?: { externalApiKey?: string }
): Promise<{
  runId: string
  status: "pending" | "running" | "completed" | "failed"
  progress?: number
  error?: string
}> {
  const db = getDb()
  await assertDocumentRecordAccess("extraction_runs", runId, db)
  const [run] = await db
    .select({
      extractor_backend: extractionRuns.extractor_backend,
      external_extractor_url: extractionRuns.external_extractor_url,
    })
    .from(extractionRuns)
    .where(eq(extractionRuns.id, runId))
    .limit(1)
  if (!run) throw new Error("Extraction run was not found.")

  const statusResponse = await getExtractionStatus(
    runId,
    getExtractorBackend(run.extractor_backend),
    getExternalRuntimeOptions({
      apiKey: getExternalApiKey(options),
      baseUrl: run.external_extractor_url,
    })
  )

  if (statusResponse.status === "running") {
    await db
      .update(extractionRuns)
      .set({ status: "running" })
      .where(eq(extractionRuns.id, runId))
  } else if (
    statusResponse.status === "completed" ||
    statusResponse.status === "failed"
  ) {
    await db
      .update(extractionRuns)
      .set({
        status: statusResponse.status,
        ...(statusResponse.status === "completed" && {
          completed_at: new Date().toISOString(),
        }),
      })
      .where(eq(extractionRuns.id, runId))
  }

  return statusResponse
}

export async function importExtractionResults(
  runId: string,
  options?: { externalApiKey?: string }
): Promise<void> {
  const db = getDb()
  await assertDocumentRecordAccess("extraction_runs", runId, db)

  const [run] = await db
    .select({
      document_id: extractionRuns.document_id,
      ontology_id: extractionRuns.ontology_id,
      extractor_backend: extractionRuns.extractor_backend,
      external_extractor_url: extractionRuns.external_extractor_url,
    })
    .from(extractionRuns)
    .where(eq(extractionRuns.id, runId))
    .limit(1)
  if (!run) throw new Error("Extraction run was not found.")

  const results = await getExtractionResults(
    runId,
    getExtractorBackend(run.extractor_backend),
    getExternalRuntimeOptions({
      apiKey: getExternalApiKey(options),
      baseUrl: run.external_extractor_url,
    })
  )
  await persistExtractionResults(runId, results, run.document_id)

  const now = new Date().toISOString()

  await db
    .update(extractionRuns)
    .set({ status: "completed", completed_at: now })
    .where(eq(extractionRuns.id, runId))

  await db
    .update(documents)
    .set({ status: "in_review" })
    .where(eq(documents.id, run.document_id))

  revalidatePath(routes.knowledgeGraph.root)
}

export async function getExternalExtractorDefaultUrl(): Promise<string> {
  const url = process.env.EXTRACTION_API_URL
  return url ? normalizeExtractorBaseUrl(url) : ""
}
