"use server"

import { getDb } from "@/server/database"
import { assertOntologyDocumentAccess } from "@/server/group-access"
import type { LinkmlLintIssue } from "../linkml/types"
import type { OhiLockVerificationReport } from "../ohi/lockfile-verifier"
import { getCompiledOntologyStudioDataAction } from "./compiler-studio"
import { getOhiPackageStateAction } from "./ohi-packages"

export interface OntologyDiagnosticsResult {
  lintIssues: LinkmlLintIssue[]
  lockVerification: OhiLockVerificationReport | null
}

/**
 * Fetches canonical LinkML compiler lint issues and `ohi.lock.json` verification
 * state for the Ontology Issues drawer.
 */
export async function getOntologyDiagnosticsAction(
  ontologyId: string
): Promise<OntologyDiagnosticsResult> {
  const db = getDb()
  await assertOntologyDocumentAccess(ontologyId, db)

  const [studioResult, ohiResult] = await Promise.allSettled([
    getCompiledOntologyStudioDataAction(ontologyId),
    getOhiPackageStateAction(ontologyId),
  ])

  const lintIssues =
    studioResult.status === "fulfilled"
      ? studioResult.value.artifacts.lint_issues
      : []

  const lockVerification =
    ohiResult.status === "fulfilled" ? ohiResult.value.verification : null

  return {
    lintIssues,
    lockVerification,
  }
}
