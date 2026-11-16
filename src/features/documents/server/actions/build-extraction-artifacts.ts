import crypto from "node:crypto"
import { eq } from "drizzle-orm"

import { compileLinkmlOntology } from "@/features/ontology/server/linkml/compiler"
import type { AnyDbClient, DbClient } from "@/features/ontology/server/linkml/document-store"
import type {
  CompiledOntologyArtifacts,
  OhiLockfileV2,
} from "@/features/ontology/server/linkml/types"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import type { ExtractionLinkmlArtifacts } from "@/server/external/extraction-api"

export interface OntologyArtifactRow {
  linkml_yaml: string | null | undefined
  compiled_artifacts?: CompiledOntologyArtifacts | null
  ohi_lockfile?: OhiLockfileV2 | Record<string, unknown> | null
}

function hasValidCompiledArtifacts(
  compiled: CompiledOntologyArtifacts | null | undefined,
  expectedSha256: string
): compiled is CompiledOntologyArtifacts {
  return Boolean(
    compiled &&
      compiled.source_sha256 === expectedSha256 &&
      typeof compiled.pydantic_py === "string" &&
      typeof compiled.json_schema === "string" &&
      typeof compiled.shacl_ttl === "string" &&
      typeof compiled.rdfs_ttl === "string"
  )
}

/**
 * Extracts LinkML extraction artifacts and OHI lockfile provenance from an
 * ontology_documents row, compiling on the fly if cached artifacts are missing or stale.
 * Returns null when linkml_yaml is absent or empty.
 */
export function extractArtifactsFromOntologyRow(
  row: OntologyArtifactRow
): ExtractionLinkmlArtifacts | null {
  const linkmlYaml = row.linkml_yaml
  if (!linkmlYaml || linkmlYaml.trim() === "") {
    return null
  }

  const sha256 = crypto.createHash("sha256").update(linkmlYaml).digest("hex")
  const artifacts = hasValidCompiledArtifacts(row.compiled_artifacts, sha256)
    ? row.compiled_artifacts
    : compileLinkmlOntology(linkmlYaml)

  return {
    linkml_yaml: linkmlYaml,
    pydantic_code: artifacts.pydantic_py,
    json_schema: artifacts.json_schema,
    shacl_ttl: artifacts.shacl_ttl,
    rdfs_ttl: artifacts.rdfs_ttl,
    ohi_lockfile:
      (row.ohi_lockfile as Record<string, unknown> | null | undefined) ?? null,
    ontology_sha256: artifacts.source_sha256 || sha256,
  }
}

/**
 * Loads the ontology document and resolves its LinkML extraction artifacts
 * and OHI lockfile provenance. Returns null if the ontology has no linkml_yaml.
 */
export async function resolveExtractionOntologyArtifacts(
  ontologyId: string,
  db?: AnyDbClient
): Promise<ExtractionLinkmlArtifacts | null> {
  const database = (db ?? getDb()) as unknown as DbClient

  const rows = (await database
    .select({
      linkml_yaml: ontologyDocuments.linkml_yaml,
      compiled_artifacts: ontologyDocuments.compiled_artifacts,
      ohi_lockfile: ontologyDocuments.ohi_lockfile,
    })
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, ontologyId))) as unknown as OntologyArtifactRow[]

  const row = rows[0]
  if (!row) {
    return null
  }

  return extractArtifactsFromOntologyRow(row)
}
