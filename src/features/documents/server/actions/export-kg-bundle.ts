"use server"

import { and, asc, desc, eq, inArray } from "drizzle-orm"

import { linkmlYamlToSnapshot } from "@/features/ontology/server/linkml/ast-mapper"
import type { AnyDbClient } from "@/features/ontology/server/linkml/document-store"
import type {
  CompiledOntologyArtifacts,
  OhiLockfileV2,
} from "@/features/ontology/server/linkml/types"
import { getDb } from "@/server/database"
import {
  documentEntities,
  documents,
  entityAttributeValues,
  evidenceAnchors,
  extractionRuns,
  factAnchors,
  facts,
  ontologyDocuments,
} from "@/server/db/schema"
import { assertDocumentAccess } from "@/server/group-access"

import { extractArtifactsFromOntologyRow } from "./build-extraction-artifacts"
import {
  buildKnowledgeGraphBundle,
  type BundleEvidenceAnchorInput,
  type BundleFactInput,
  type KnowledgeGraphExportBundle,
} from "./build-kg-bundle"

export type { KnowledgeGraphExportBundle } from "./build-kg-bundle"

export async function exportKnowledgeGraphBundleAction(
  documentId: string,
  db?: AnyDbClient
): Promise<KnowledgeGraphExportBundle> {
  const database = (db ?? getDb()) as unknown as ReturnType<typeof getDb>
  await assertDocumentAccess(documentId, database)

  const [docRows, runRows, acceptedEntityRows, acceptedFactRows] =
    await Promise.all([
      database
        .select({
          id: documents.id,
          title: documents.title,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1),
      database
        .select()
        .from(extractionRuns)
        .where(eq(extractionRuns.document_id, documentId))
        .orderBy(desc(extractionRuns.created_at))
        .limit(1),
      database
        .select()
        .from(documentEntities)
        .where(
          and(
            eq(documentEntities.document_id, documentId),
            eq(documentEntities.review_status, "accepted")
          )
        )
        .orderBy(asc(documentEntities.entity_text)),
      database
        .select()
        .from(facts)
        .where(
          and(
            eq(facts.document_id, documentId),
            eq(facts.review_status, "accepted")
          )
        )
        .orderBy(asc(facts.created_at)),
    ])

  const doc = docRows[0]
  if (!doc) {
    throw new Error("Document was not found.")
  }

  const latestRun = runRows[0] ?? null
  const acceptedEntityIds = acceptedEntityRows.map((entity) => entity.id)
  const acceptedFactIds = acceptedFactRows.map((fact) => fact.id)

  const [attributeRows, factAnchorRows, ontologyRows] = await Promise.all([
    acceptedEntityIds.length > 0
      ? database
          .select()
          .from(entityAttributeValues)
          .where(inArray(entityAttributeValues.entity_id, acceptedEntityIds))
      : Promise.resolve([]),
    acceptedFactIds.length > 0
      ? database
          .select({
            fact_id: factAnchors.fact_id,
            anchor: evidenceAnchors,
          })
          .from(factAnchors)
          .innerJoin(
            evidenceAnchors,
            eq(factAnchors.anchor_id, evidenceAnchors.id)
          )
          .where(inArray(factAnchors.fact_id, acceptedFactIds))
      : Promise.resolve([]),
    latestRun?.ontology_id
      ? database
          .select({
            id: ontologyDocuments.id,
            name: ontologyDocuments.name,
            linkml_yaml: ontologyDocuments.linkml_yaml,
            compiled_artifacts: ontologyDocuments.compiled_artifacts,
            ohi_lockfile: ontologyDocuments.ohi_lockfile,
          })
          .from(ontologyDocuments)
          .where(eq(ontologyDocuments.id, latestRun.ontology_id))
          .limit(1)
      : Promise.resolve([]),
  ])

  const ontologyRow = ontologyRows[0] ?? null
  let compiledArtifacts: Pick<
    CompiledOntologyArtifacts,
    "rdfs_ttl" | "shacl_ttl" | "pydantic_py" | "source_sha256"
  > | null = null
  let baseIri: string | null = null
  const attributeDataTypeById = new Map<string, string>()

  if (ontologyRow) {
    const resolved = extractArtifactsFromOntologyRow({
      linkml_yaml: ontologyRow.linkml_yaml,
      compiled_artifacts: ontologyRow.compiled_artifacts,
      ohi_lockfile: ontologyRow.ohi_lockfile,
    })
    if (resolved) {
      compiledArtifacts = {
        rdfs_ttl: resolved.rdfs_ttl ?? "",
        shacl_ttl: resolved.shacl_ttl ?? "",
        pydantic_py: resolved.pydantic_code ?? "",
        source_sha256: resolved.ontology_sha256 ?? "",
      }
    }
    if (ontologyRow.linkml_yaml && ontologyRow.linkml_yaml.trim() !== "") {
      const snapshot = linkmlYamlToSnapshot(
        ontologyRow.id,
        ontologyRow.linkml_yaml
      )
      baseIri = snapshot.document.base_iri ?? null
      for (const attr of snapshot.attributes ?? []) {
        if (attr.data_type) {
          attributeDataTypeById.set(attr.id, attr.data_type)
        }
      }
    }
  }

  const anchorIdsByFactId = new Map<string, Set<string>>()
  const anchorsById = new Map<string, BundleEvidenceAnchorInput>()
  for (const row of factAnchorRows) {
    const set = anchorIdsByFactId.get(row.fact_id) ?? new Set<string>()
    set.add(row.anchor.id)
    anchorIdsByFactId.set(row.fact_id, set)
    if (!anchorsById.has(row.anchor.id)) {
      anchorsById.set(row.anchor.id, {
        id: row.anchor.id,
        quote_text: row.anchor.quote_text,
        page_from: row.anchor.page_from,
        page_to: row.anchor.page_to,
      })
    }
  }

  const factInputs: BundleFactInput[] = acceptedFactRows.map((fact) => {
    const anchorSet = new Set<string>(anchorIdsByFactId.get(fact.id) ?? [])
    if (fact.primary_anchor_id && anchorsById.has(fact.primary_anchor_id)) {
      anchorSet.add(fact.primary_anchor_id)
    }
    return {
      id: fact.id,
      subject_entity_id: fact.subject_entity_id,
      subject_text: fact.subject_text,
      relation_type_id: fact.relation_type_id,
      relation_text: fact.relation_text,
      object_entity_id: fact.object_entity_id,
      object_text: fact.object_text,
      review_status: fact.review_status,
      confidence: fact.confidence,
      anchor_ids: Array.from(anchorSet),
    }
  })

  return buildKnowledgeGraphBundle({
    document: {
      id: doc.id,
      title: doc.title,
    },
    ontology: ontologyRow
      ? {
          id: ontologyRow.id,
          name: ontologyRow.name,
          baseIri,
          ohiLockfile: (ontologyRow.ohi_lockfile as OhiLockfileV2 | null) ?? null,
        }
      : null,
    compiledArtifacts,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          ontology_id: latestRun.ontology_id,
          ontology_sha256: latestRun.ontology_sha256,
          ohi_lockfile_snapshot:
            (latestRun.ohi_lockfile_snapshot as OhiLockfileV2 | null) ?? null,
          started_at: latestRun.started_at,
          completed_at: latestRun.completed_at,
        }
      : null,
    entities: acceptedEntityRows.map((entity) => ({
      id: entity.id,
      entity_text: entity.entity_text,
      class_id: entity.class_id,
      review_status: entity.review_status,
    })),
    entityAttributes: attributeRows.map((attr) => ({
      entity_id: attr.entity_id,
      attribute_id: attr.attribute_id,
      data_type: attributeDataTypeById.get(attr.attribute_id) ?? "xsd:string",
      value: attr.value,
    })),
    facts: factInputs,
    evidenceAnchors: Array.from(anchorsById.values()),
  })
}
