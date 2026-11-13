"use server"

import crypto from "node:crypto"
import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import YAML from "yaml"

import { routes } from "@/lib/routes"
import { getDb } from "@/server/database"
import {
  documentEntities,
  extractionRuns,
  facts,
  ontologyCompetencyQuestions,
  ontologyDocuments,
} from "@/server/db/schema"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import {
  linkmlYamlToSnapshot,
  snapshotToLinkmlYaml,
} from "../linkml/ast-mapper"
import { compileLinkmlOntology } from "../linkml/compiler"
import {
  loadCanonicalOntology,
  saveCanonicalOntology,
} from "../linkml/document-store"
import { diffLinkmlSnapshots } from "../linkml/symbol-cascade"
import type {
  CanonicalOntologySnapshot,
  CompiledOntologyArtifacts,
  LinkmlLintIssue,
  OhiLockfileV2,
} from "../linkml/types"

export interface CompilerStudioData {
  ontologyId: string
  ontologyName: string
  linkmlYaml: string
  ohiYaml: string
  ohiLockfile: OhiLockfileV2 | null
  artifacts: CompiledOntologyArtifacts
}

export interface CascadePreview {
  deletedClasses: string[]
  deletedRelations: string[]
  deletedAttributes: string[]
  deletedModules: string[]
  renamedClasses: Array<{ oldKey: string; newKey: string }>
  renamedRelations: Array<{ oldKey: string; newKey: string }>
  impactedEntitiesCount: number
  impactedFactsCount: number
  impactedCqsCount: number
}

export type SaveRawLinkmlResult =
  | {
      ok: true
      data: CompilerStudioData
    }
  | {
      ok: false
      requiresConfirmation: true
      cascadePreview: CascadePreview
    }
  | {
      ok: false
      requiresConfirmation?: false
      error: string
      diagnostics: LinkmlLintIssue[]
    }

function hasBlockingCompileError(issues: LinkmlLintIssue[]): boolean {
  return issues.some(
    (issue) => issue.severity === "FATAL" || issue.severity === "ERROR"
  )
}

export async function getCompiledOntologyStudioDataAction(
  ontologyId: string
): Promise<CompilerStudioData> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const rows = await db
    .select()
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, ontologyId))

  const row = rows[0]
  if (!row) {
    throw new Error(`Ontology document not found: ${ontologyId}`)
  }

  let linkmlYaml = row.linkml_yaml
  if (!linkmlYaml || linkmlYaml.trim() === "") {
    const snapshot = await loadCanonicalOntology(ontologyId, db)
    linkmlYaml = snapshotToLinkmlYaml(snapshot)
  }

  const sha256 = crypto.createHash("sha256").update(linkmlYaml).digest("hex")
  const artifacts =
    row.compiled_artifacts && row.compiled_artifacts.source_sha256 === sha256
      ? row.compiled_artifacts
      : compileLinkmlOntology(linkmlYaml)

  return {
    ontologyId: row.id,
    ontologyName: row.name,
    linkmlYaml,
    ohiYaml: row.ohi_yaml ?? "",
    ohiLockfile: row.ohi_lockfile ?? null,
    artifacts,
  }
}

export async function saveRawLinkmlYamlAction(
  ontologyId: string,
  newLinkmlYaml: string,
  confirmCascade = false
): Promise<SaveRawLinkmlResult> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  if (!newLinkmlYaml || newLinkmlYaml.trim() === "") {
    const diagnostic: LinkmlLintIssue = {
      issue_type: "SyntaxError",
      severity: "FATAL",
      message: "LinkML YAML cannot be empty.",
    }
    return {
      ok: false,
      error: diagnostic.message,
      diagnostics: [diagnostic],
    }
  }

  let parsedRaw: unknown
  try {
    parsedRaw = YAML.parse(newLinkmlYaml)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse LinkML YAML."
    return {
      ok: false,
      error: message,
      diagnostics: [
        {
          issue_type: "SyntaxError",
          severity: "FATAL",
          message,
        },
      ],
    }
  }

  if (!parsedRaw || typeof parsedRaw !== "object" || Array.isArray(parsedRaw)) {
    const message = "LinkML YAML must define a root schema mapping object."
    return {
      ok: false,
      error: message,
      diagnostics: [
        {
          issue_type: "SyntaxError",
          severity: "FATAL",
          message,
        },
      ],
    }
  }

  const artifacts = compileLinkmlOntology(newLinkmlYaml)
  if (hasBlockingCompileError(artifacts.lint_issues)) {
    const firstBlocking = artifacts.lint_issues.find(
      (issue) => issue.severity === "FATAL" || issue.severity === "ERROR"
    )
    return {
      ok: false,
      error:
        firstBlocking?.message ??
        "LinkML schema failed validation and could not be compiled.",
      diagnostics: artifacts.lint_issues,
    }
  }

  const beforeSnapshot = await loadCanonicalOntology(ontologyId, db)

  let afterSnapshot: CanonicalOntologySnapshot
  try {
    afterSnapshot = linkmlYamlToSnapshot(
      ontologyId,
      newLinkmlYaml,
      beforeSnapshot.ui_layout
    )
    afterSnapshot.document.id = ontologyId
    if (beforeSnapshot.document.group_key) {
      afterSnapshot.document.group_key = beforeSnapshot.document.group_key
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to map LinkML YAML to canonical ontology snapshot."
    return {
      ok: false,
      error: message,
      diagnostics: [
        {
          issue_type: "SnapshotMappingError",
          severity: "FATAL",
          message,
        },
      ],
    }
  }

  const diff = diffLinkmlSnapshots(beforeSnapshot, afterSnapshot)

  if (diff.deletions.length > 0 && !confirmCascade) {
    const runs = await db
      .select({ id: extractionRuns.id })
      .from(extractionRuns)
      .where(eq(extractionRuns.ontology_id, ontologyId))
    const runIds = runs.map((r) => r.id)

    let impactedEntitiesCount = 0
    let impactedFactsCount = 0

    if (runIds.length > 0) {
      if (diff.deletedClasses.length > 0) {
        const entities = await db
          .select({ id: documentEntities.id })
          .from(documentEntities)
          .where(
            and(
              inArray(documentEntities.extraction_run_id, runIds),
              inArray(documentEntities.class_id, diff.deletedClasses)
            )
          )
        impactedEntitiesCount = entities.length
      }

      if (diff.deletedRelations.length > 0) {
        const impactedFacts = await db
          .select({ id: facts.id })
          .from(facts)
          .where(
            and(
              inArray(facts.extraction_run_id, runIds),
              inArray(facts.relation_type_id, diff.deletedRelations)
            )
          )
        impactedFactsCount = impactedFacts.length
      }
    }

    const cqs = await db
      .select()
      .from(ontologyCompetencyQuestions)
      .where(eq(ontologyCompetencyQuestions.ontology_id, ontologyId))

    const deletedClassSet = new Set(diff.deletedClasses)
    const deletedRelationSet = new Set(diff.deletedRelations)
    const impactedCqsCount = cqs.filter(
      (cq) =>
        (cq.subject_class_id !== null &&
          deletedClassSet.has(cq.subject_class_id)) ||
        (cq.object_class_id !== null &&
          deletedClassSet.has(cq.object_class_id)) ||
        (cq.predicate_relation_id !== null &&
          deletedRelationSet.has(cq.predicate_relation_id))
    ).length

    return {
      ok: false,
      requiresConfirmation: true,
      cascadePreview: {
        deletedClasses: diff.deletedClasses,
        deletedRelations: diff.deletedRelations,
        deletedAttributes: diff.deletedAttributes,
        deletedModules: diff.deletedModules,
        renamedClasses: diff.renamedClasses,
        renamedRelations: diff.renamedRelations,
        impactedEntitiesCount,
        impactedFactsCount,
        impactedCqsCount,
      },
    }
  }

  await saveCanonicalOntology(ontologyId, () => afterSnapshot, {
    db,
    recompile: false,
  })

  await db
    .update(ontologyDocuments)
    .set({
      linkml_yaml: newLinkmlYaml,
      compiled_artifacts: artifacts,
    })
    .where(eq(ontologyDocuments.id, ontologyId))

  const rows = await db
    .select()
    .from(ontologyDocuments)
    .where(eq(ontologyDocuments.id, ontologyId))
  const updatedRow = rows[0]

  try {
    revalidatePath(routes.ontology.root, "layout")
  } catch {
    // Safe fallback when invoked outside a Next.js request context (e.g. unit tests)
  }

  return {
    ok: true,
    data: {
      ontologyId,
      ontologyName: updatedRow?.name ?? afterSnapshot.document.name,
      linkmlYaml: newLinkmlYaml,
      ohiYaml: updatedRow?.ohi_yaml ?? "",
      ohiLockfile: updatedRow?.ohi_lockfile ?? null,
      artifacts,
    },
  }
}
