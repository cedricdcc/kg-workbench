import type { LinkmlLintIssue } from "@/features/ontology/server/linkml/types"
import type { OhiLockVerificationReport } from "@/features/ontology/server/ohi/lockfile-verifier"
import type { OntologyDefect, OntologyDefectSeverity } from "./types"

function mapLinkmlSeverity(severity: string): OntologyDefectSeverity {
  const normalized = severity.trim().toUpperCase()
  if (normalized === "FATAL" || normalized === "ERROR") {
    return "error"
  }
  if (normalized === "WARNING") {
    return "warning"
  }
  return "info"
}

/**
 * Maps canonical LinkML compiler `lint_issues` into unified `OntologyDefect` entries.
 */
export function mapLinkmlLintIssuesToDefects(
  issues: LinkmlLintIssue[],
  classes: Array<{ id: string; name: string }> = [],
  relations: Array<{ id: string; name: string }> = []
): OntologyDefect[] {
  if (!issues || issues.length === 0) {
    return []
  }

  const classByName = new Map<string, { id: string; name: string }>()
  for (const cls of classes) {
    classByName.set(cls.name.trim().toLowerCase(), cls)
  }

  const relationByName = new Map<string, { id: string; name: string }>()
  for (const rel of relations) {
    relationByName.set(rel.name.trim().toLowerCase(), rel)
  }

  return issues.map((issue, index): OntologyDefect => {
    const elementKey = issue.element?.trim()
    const normalizedElement = elementKey?.toLowerCase()

    const matchedClass = normalizedElement
      ? classByName.get(normalizedElement)
      : undefined
    const matchedRelation =
      !matchedClass && normalizedElement
        ? relationByName.get(normalizedElement)
        : undefined

    let targetType: OntologyDefect["targetType"] = "ontology"
    let targetId = "ontology"
    let targetName = elementKey || "LinkML Schema"

    if (matchedClass) {
      targetType = "class"
      targetId = matchedClass.id
      targetName = matchedClass.name
    } else if (matchedRelation) {
      targetType = "relation"
      targetId = matchedRelation.id
      targetName = matchedRelation.name
    }

    return {
      id: `linkml:${issue.issue_type}:${elementKey ?? "schema"}:${index}`,
      kind: "linkml_lint_issue",
      severity: mapLinkmlSeverity(issue.severity),
      targetType,
      targetId,
      targetName,
      title: issue.issue_type,
      description: issue.message,
      source: "linkml",
      ...(elementKey ? { element: elementKey } : {}),
    }
  })
}

/**
 * Maps `ohi.lock.json` SHA-256 verification mismatches into actionable drift warnings.
 */
export function mapOhiLockfileDriftToDefects(
  report: OhiLockVerificationReport | null | undefined
): OntologyDefect[] {
  if (!report || report.valid || report.mismatched_files.length === 0) {
    return []
  }

  return report.mismatched_files.map((mismatch): OntologyDefect => {
    const expectedShort = mismatch.expected_sha256.slice(0, 12)
    const actualPart = mismatch.actual_sha256
      ? `, actual SHA-256: ${mismatch.actual_sha256.slice(0, 12)}...`
      : ""

    return {
      id: `ohi-drift:${mismatch.path}`,
      kind: "ohi_lockfile_drift",
      severity: "warning",
      targetType: "ontology",
      targetId: mismatch.path,
      targetName: mismatch.ontology || mismatch.path,
      title:
        mismatch.reason === "tampered"
          ? "ohi.lock.json SHA-256 Drift Detected"
          : "Missing Locked ohi Artifact",
      description: `Locked artifact "${mismatch.path}" failed verification (${mismatch.reason}; expected SHA-256: ${expectedShort}...${actualPart}).`,
      suggestedAction: "Sync Lockfile (ohi sync)",
      quickFixType: "ohi_sync",
      source: "ohi",
    }
  })
}
