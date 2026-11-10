import { eq } from "drizzle-orm"
import { getDb } from "@/server/database"
import { ontologyDocuments } from "@/server/db/schema"
import { linkmlYamlToSnapshot, snapshotToLinkmlYaml } from "./ast-mapper"
import { compileSnapshotArtifacts } from "./compiler"
import {
  cascadeSymbolDelete,
  cascadeSymbolRename,
  diffLinkmlSnapshots,
  type DbTransaction,
} from "./symbol-cascade"
import type {
  CanonicalOntologySnapshot,
  CompiledOntologyArtifacts,
} from "./types"

export interface DbClient extends DbTransaction {
  transaction?: <T>(cb: (tx: DbTransaction) => Promise<T>) => Promise<T>
}

export interface SaveCanonicalOntologyOptions {
  recompile?: boolean
  db?: DbClient
}

/**
 * Loads the canonical ontology snapshot from the database (linkml_yaml + ui_layout),
 * returning a minimal default snapshot if linkml_yaml is not yet initialized.
 */
export async function loadCanonicalOntology(
  ontologyId: string,
  db?: DbClient
): Promise<CanonicalOntologySnapshot> {
  const database = (db ?? getDb()) as unknown as DbClient

  const rows = (await database
    .select()
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, ontologyId))) as Array<
    typeof ontologyDocuments.$inferSelect
  >

  const row = rows[0]
  if (!row) {
    throw new Error(`Ontology document not found: ${ontologyId}`)
  }

  if (!row.linkml_yaml || row.linkml_yaml.trim() === "") {
    return {
      document: {
        id: row.id,
        name: row.name,
        version: row.version ?? "1.0.0",
        default_language: row.default_language ?? "en",
        usecase: row.usecase ?? "",
        group_key: row.group_key ?? "shared",
      },
      modules: [],
      classes: [],
      attributes: [],
      relations: [],
      relation_attributes: [],
      restrictions: [],
      disjointness: [],
      notes: [],
      examples: [],
      localized_texts: [],
      ui_layout: row.ui_layout ?? { classPositions: {}, moduleLayouts: {} },
    }
  }

  const snapshot = linkmlYamlToSnapshot(row.id, row.linkml_yaml, row.ui_layout)
  snapshot.document.id = row.id
  snapshot.document.name = row.name || snapshot.document.name
  if (row.version) snapshot.document.version = row.version
  if (row.group_key) snapshot.document.group_key = row.group_key
  if (row.default_language)
    snapshot.document.default_language = row.default_language
  if (row.usecase) snapshot.document.usecase = row.usecase
  if (row.ui_layout) snapshot.ui_layout = row.ui_layout

  return snapshot
}

/**
 * Executes a mutation against the canonical ontology snapshot inside a database transaction,
 * diffs the before/after AST symbols, cascades renames and deletions across external tables,
 * and updates linkml_yaml, ui_layout, and compiled_artifacts on ontology_documents.
 */
export async function saveCanonicalOntology(
  ontologyId: string,
  mutator: (draft: CanonicalOntologySnapshot) => void | Promise<void>,
  options?: SaveCanonicalOntologyOptions
): Promise<CanonicalOntologySnapshot> {
  const database = (options?.db ?? getDb()) as unknown as DbClient

  const executeInTx = async (
    tx: DbTransaction
  ): Promise<CanonicalOntologySnapshot> => {
    const before = await loadCanonicalOntology(ontologyId, tx as DbClient)
    const draft: CanonicalOntologySnapshot = structuredClone(before)
    await mutator(draft)

    const diff = diffLinkmlSnapshots(before, draft)

    // Run cascade renames
    for (const rename of diff.renames) {
      await cascadeSymbolRename(
        tx,
        ontologyId,
        rename.kind,
        rename.oldKey,
        rename.newKey
      )
    }

    // Run cascade deletions
    for (const deletion of diff.deletions) {
      await cascadeSymbolDelete(tx, ontologyId, deletion.kind, deletion.key)
    }

    // Recompile artifacts if requested
    let linkmlYaml: string
    let artifacts: CompiledOntologyArtifacts | null = null

    if (options?.recompile !== false) {
      const compiled = compileSnapshotArtifacts(draft)
      linkmlYaml = compiled.linkmlYaml
      artifacts = compiled.artifacts
    } else {
      linkmlYaml = snapshotToLinkmlYaml(draft)
    }

    const uiLayout = draft.ui_layout ?? {
      classPositions: {},
      moduleLayouts: {},
    }

    await tx
      .update(ontologyDocuments)
      .set({
        name: draft.document.name,
        version: draft.document.version ?? "1.0.0",
        usecase: draft.document.usecase ?? "",
        default_language: draft.document.default_language ?? "en",
        linkml_yaml: linkmlYaml,
        ui_layout: uiLayout,
        ...(artifacts !== null && { compiled_artifacts: artifacts }),
      })
      .where(eq(ontologyDocuments.id, ontologyId))

    return draft
  }

  if (typeof database.transaction === "function") {
    return await database.transaction((tx: DbTransaction) => executeInTx(tx))
  }

  return await executeInTx(database)
}
