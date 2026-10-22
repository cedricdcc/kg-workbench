"use server"

import { and, desc, eq, ne, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import {
  ontologyClasses,
  referenceOntologies,
  referenceOntologyTerms,
  registryEndpointSnapshots,
  userApiKeys,
} from "@/server/db/schema"
import {
  assertOntologyDocumentAccess,
  assertOntologyRecordAccess,
  getCurrentGroupKeyOrThrow,
} from "@/server/group-access"
import {
  fetchRegistryTerms,
  getRegistryProvider,
  searchRegistries,
  type EndpointTestResult,
  type RegistrySearchResult,
} from "@/features/ontology/server/services/vocabulary-registries"
import { formatKeyHint, getEffectiveApiKey } from "@/server/api-keys"
import { encryptSecret } from "@/server/crypto"
import { getUserIdFromCookies } from "@/server/user-identity"
import {
  getLocalBatchEmbeddings,
  getLocalEmbedding,
} from "@/server/embedding/local-embedder"
import { rankTermsBySimilarity } from "@/features/ontology/server/services/vector-similarity"
import { getActiveReferenceTerms } from "@/features/ontology/server/queries/reference-vocabularies"

export type AddReferenceOntologyInput = {
  prefix: string
  name: string
  baseIri: string
  sourceRegistry:
    | "ols"
    | "lov"
    | "bartoc"
    | "agroportal"
    | "bioportal"
    | "ecoportal"
    | "eu_vocabularies"
    | "custom"
    | string
  sourceId: string
  version?: string
}

export type SyncResult = {
  termsSynced: number
}

export type TermAlignmentCandidate = {
  curie: string
  iri: string
  label: string
  type: string
  description: string
  similarity: number
}

export async function addReferenceOntology(
  input: AddReferenceOntologyInput
): Promise<{ id: string; prefix: string; name: string }> {
  const prefix = input.prefix?.trim().toLowerCase()
  if (!prefix) {
    throw new Error("Prefix is required.")
  }

  const name = input.name?.trim() || prefix.toUpperCase()
  const baseIri = input.baseIri?.trim()
  if (!baseIri) {
    throw new Error("Base IRI is required.")
  }

  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const [inserted] = await db
    .insert(referenceOntologies)
    .values({
      prefix,
      name,
      base_iri: baseIri,
      source_registry: input.sourceRegistry || "ols",
      source_id: input.sourceId || prefix,
      version: input.version || "",
      group_key: groupKey,
    })
    .returning()

  if (!inserted) {
    throw new Error("Failed to insert reference ontology.")
  }

  // Trigger initial term sync asynchronously in background or inline
  try {
    await syncReferenceOntology(inserted.id)
  } catch (err) {
    console.error(`Initial sync for ${prefix} failed:`, err)
  }

  revalidatePath(routes.ontology.root)
  return { id: inserted.id, prefix: inserted.prefix, name: inserted.name }
}

export async function syncReferenceOntology(
  referenceOntologyId: string
): Promise<SyncResult> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const [ont] = await db
    .select()
    .from(referenceOntologies)
    .where(eq(referenceOntologies.id, referenceOntologyId))
    .limit(1)

  if (!ont) {
    throw new Error("Reference ontology not found.")
  }

  // Fetch terms from public registry
  const terms = await fetchRegistryTerms(
    ont.source_registry as "ols" | "lov",
    ont.source_id
  )

  if (terms.length === 0) {
    return { termsSynced: 0 }
  }

  // Limit max terms to 500 per ontology for responsive indexing
  const limitedTerms = terms.slice(0, 500)

  // Compute local embeddings for term signatures
  const signatures = limitedTerms.map(
    (t) => `${t.label} (${t.curie}): ${t.description} ${t.synonyms.join(" ")}`
  )
  const embeddings = await getLocalBatchEmbeddings(signatures)

  await db.transaction(async (tx) => {
    // Delete existing cached terms
    await tx
      .delete(referenceOntologyTerms)
      .where(eq(referenceOntologyTerms.reference_ontology_id, ont.id))

    // Insert new terms with embeddings
    const toInsert = limitedTerms.map((t, idx) => ({
      reference_ontology_id: ont.id,
      curie: t.curie,
      iri: t.iri,
      label: t.label,
      type: t.type,
      description: t.description || "",
      synonyms: t.synonyms || [],
      parent_iris: t.parentIris || [],
      related_property_iris: t.relatedPropertyIris || [],
      embedding: embeddings[idx] || null,
      group_key: groupKey,
    }))

    if (toInsert.length > 0) {
      await tx.insert(referenceOntologyTerms).values(toInsert)
    }

    // Update synced_at timestamp
    await tx
      .update(referenceOntologies)
      .set({ synced_at: new Date().toISOString() })
      .where(eq(referenceOntologies.id, ont.id))
  })

  revalidatePath(routes.ontology.root)
  return { termsSynced: limitedTerms.length }
}

export async function deleteReferenceOntology(
  referenceOntologyId: string
): Promise<void> {
  const db = getDb()
  await db
    .delete(referenceOntologies)
    .where(eq(referenceOntologies.id, referenceOntologyId))

  revalidatePath(routes.ontology.root)
}

export async function searchExternalRegistries(
  query: string
): Promise<RegistrySearchResult[]> {
  return searchRegistries(query)
}

export async function findNearestStandardTerms(
  query: string,
  type?: "class" | "property",
  limit = 3
): Promise<TermAlignmentCandidate[]> {
  const trimmed = query?.trim()
  if (!trimmed) return []

  const activeTerms = await getActiveReferenceTerms()
  if (activeTerms.length === 0) return []

  const filtered = type
    ? activeTerms.filter((t) => t.type === type)
    : activeTerms
  if (filtered.length === 0) return []

  const queryVector = await getLocalEmbedding(trimmed)

  const ranked = rankTermsBySimilarity(queryVector, filtered, {
    minSimilarity: 0.05,
    topK: limit,
  })

  return ranked.map((r) => ({
    curie: r.curie,
    iri: r.iri,
    label: r.label,
    type: r.type,
    description: r.description,
    similarity: r.similarity,
  }))
}

export async function mapClassToStandardParent(
  ontologyId: string,
  classId: string,
  candidate: { curie: string; label: string; description?: string }
): Promise<{ parentClassId: string }> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)
  await assertOntologyRecordAccess("ontology_classes", classId, db)

  const parentName = candidate.curie || candidate.label

  // Find if parent already exists in this ontology (excluding the target class itself)
  const [existingParent] = await db
    .select()
    .from(ontologyClasses)
    .where(
      and(
        eq(ontologyClasses.ontology_id, ontologyId),
        ne(ontologyClasses.id, classId),
        or(
          eq(ontologyClasses.name, parentName),
          eq(ontologyClasses.name, candidate.curie)
        )
      )
    )
    .limit(1)

  let parentId: string

  if (existingParent) {
    parentId = existingParent.id
  } else {
    // Get target class to determine module_id
    const [targetClass] = await db
      .select()
      .from(ontologyClasses)
      .where(eq(ontologyClasses.id, classId))
      .limit(1)

    const [createdParent] = await db
      .insert(ontologyClasses)
      .values({
        ontology_id: ontologyId,
        module_id: targetClass?.module_id ?? null,
        name: parentName,
        description:
          candidate.description ||
          `Standard vocabulary class (${candidate.curie})`,
      })
      .returning()

    if (!createdParent) {
      throw new Error("Failed to create parent standard class.")
    }
    parentId = createdParent.id
  }

  // Update target class parent_class_id
  await db
    .update(ontologyClasses)
    .set({ parent_class_id: parentId })
    .where(eq(ontologyClasses.id, classId))

  revalidatePath(routes.ontology.document(ontologyId), "layout")
  revalidatePath(routes.ontology.root, "layout")

  return { parentClassId: parentId }
}

export async function importReferenceOntologyFile(input: {
  fileName: string
  content: string
  format?: "turtle" | "rdfxml"
}): Promise<{ id: string; prefix: string; name: string; termsSynced: number }> {
  const format =
    input.format ||
    (input.fileName.endsWith(".ttl") || input.fileName.endsWith(".n3")
      ? "turtle"
      : "rdfxml")

  const { parseRdfTurtle, parseRdfXml } =
    await import("../services/vocabulary-ingestion/rdf-parser")
  const parsed =
    format === "turtle"
      ? parseRdfTurtle(input.content)
      : parseRdfXml(input.content)

  if (parsed.terms.length === 0) {
    throw new Error(
      "No classes or properties found in the uploaded ontology file."
    )
  }

  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const [inserted] = await db
    .insert(referenceOntologies)
    .values({
      prefix: parsed.prefix,
      name: parsed.name,
      base_iri: parsed.baseIri,
      source_registry: "custom",
      source_id: parsed.prefix,
      version: "",
      group_key: groupKey,
    })
    .returning()

  if (!inserted) {
    throw new Error("Failed to register custom ontology.")
  }

  const limitedTerms = parsed.terms.slice(0, 500)
  const signatures = limitedTerms.map(
    (t) => `${t.label} (${t.curie}): ${t.description} ${t.synonyms.join(" ")}`
  )
  const embeddings = await getLocalBatchEmbeddings(signatures)

  const toInsert = limitedTerms.map((t, idx) => ({
    reference_ontology_id: inserted.id,
    curie: t.curie,
    iri: t.iri,
    label: t.label,
    type: t.type,
    property_kind: t.propertyKind ?? null,
    description: t.description || "",
    synonyms: t.synonyms || [],
    parent_iris: t.parentIris || [],
    domain_iris: t.domainIris || [],
    range_iris: t.rangeIris || [],
    related_property_iris: [],
    embedding: embeddings[idx] || null,
    group_key: groupKey,
  }))

  if (toInsert.length > 0) {
    await db.insert(referenceOntologyTerms).values(toInsert)
  }

  revalidatePath(routes.ontology.root)
  return {
    id: inserted.id,
    prefix: inserted.prefix,
    name: inserted.name,
    termsSynced: toInsert.length,
  }
}

export interface SnapshotSummary {
  id: string
  providerId: string
  endpointUrl: string
  statusCode: number
  latencyMs: number
  queryParams?: string | null
  responsePayload: string
  detectedVocabCount: number
  createdAt: string
}

export async function testRegistryEndpoint(input: {
  providerId: string
  endpointUrl: string
  apiKey?: string
  testQuery?: string
}): Promise<EndpointTestResult> {
  const provider =
    getRegistryProvider(input.providerId) || getRegistryProvider("custom")
  if (!provider) {
    throw new Error(`Provider "${input.providerId}" not found.`)
  }

  let effectiveKey = input.apiKey?.trim()
  if (!effectiveKey) {
    effectiveKey = (await getEffectiveApiKey(input.providerId)) || undefined
  }

  return provider.testEndpoint(input.endpointUrl, effectiveKey, input.testQuery)
}

export async function saveEndpointSnapshot(input: {
  providerId: string
  endpointUrl: string
  statusCode: number
  latencyMs: number
  queryParams?: string
  responsePayload: string
  detectedVocabCount: number
}): Promise<{ id: string }> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const [inserted] = await db
    .insert(registryEndpointSnapshots)
    .values({
      group_key: groupKey,
      provider_id: input.providerId,
      endpoint_url: input.endpointUrl,
      status_code: input.statusCode,
      latency_ms: input.latencyMs,
      query_params: input.queryParams || "",
      response_payload: input.responsePayload,
      detected_vocab_count: input.detectedVocabCount,
    })
    .returning()

  if (!inserted) {
    throw new Error("Failed to save endpoint snapshot.")
  }

  return { id: inserted.id }
}

export async function getEndpointSnapshots(
  providerId?: string
): Promise<SnapshotSummary[]> {
  const db = getDb()
  const groupKey = await getCurrentGroupKeyOrThrow().catch(() => "shared")

  const condition = providerId
    ? and(
        eq(registryEndpointSnapshots.group_key, groupKey),
        eq(registryEndpointSnapshots.provider_id, providerId)
      )
    : eq(registryEndpointSnapshots.group_key, groupKey)

  const rows = await db
    .select()
    .from(registryEndpointSnapshots)
    .where(condition)
    .orderBy(desc(registryEndpointSnapshots.created_at))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    providerId: r.provider_id,
    endpointUrl: r.endpoint_url,
    statusCode: r.status_code,
    latencyMs: r.latency_ms,
    queryParams: r.query_params,
    responsePayload: r.response_payload,
    detectedVocabCount: r.detected_vocab_count,
    createdAt: r.created_at
      ? new Date(r.created_at).toISOString()
      : new Date().toISOString(),
  }))
}

export async function deleteEndpointSnapshot(
  snapshotId: string
): Promise<void> {
  const db = getDb()
  await db
    .delete(registryEndpointSnapshots)
    .where(eq(registryEndpointSnapshots.id, snapshotId))
}

export async function saveRegistryApiKey(
  provider: string,
  apiKey: string
): Promise<void> {
  const trimmed = apiKey?.trim()
  if (!trimmed) {
    throw new Error("API key cannot be empty.")
  }

  const userId = await getUserIdFromCookies()
  if (!userId) {
    throw new Error("User session cookie not found.")
  }

  const { ciphertext, iv, tag } = encryptSecret(trimmed)
  const keyHint = formatKeyHint(trimmed)

  const db = getDb()
  await db
    .insert(userApiKeys)
    .values({
      user_id: userId,
      provider,
      encrypted_key: ciphertext,
      iv,
      tag,
      key_hint: keyHint,
    })
    .onConflictDoUpdate({
      target: [userApiKeys.user_id, userApiKeys.provider],
      set: {
        encrypted_key: ciphertext,
        iv,
        tag,
        key_hint: keyHint,
        updated_at: new Date().toISOString(),
      },
    })
}
