import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("Obsolete ontology-analysis-report-dialog and ontology-defects folders are deleted", () => {
  const dialogDir = path.resolve(
    process.cwd(),
    "src/features/ontology/components/dialogs/ontology-analysis-report-dialog"
  )
  assert.ok(
    !fs.existsSync(dialogDir),
    "ontology-analysis-report-dialog directory must be deleted"
  )

  const legacyDefectsDir = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-defects"
  )
  assert.ok(
    !fs.existsSync(legacyDefectsDir),
    "ontology-defects directory must be deleted and consolidated into ontology-issues"
  )
})

test("OntologyShell integrates OntologyIssuesSheet and passes typed issuesCounts", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-shell/ontology-shell.tsx"
  )
  assert.ok(fs.existsSync(shellPath), "ontology-shell.tsx must exist")
  const content = fs.readFileSync(shellPath, "utf-8")

  assert.ok(
    content.includes("OntologyIssuesSheet"),
    "OntologyShell must import and use OntologyIssuesSheet"
  )
  assert.ok(
    content.includes("issuesCounts"),
    "OntologyShell must compute and pass issuesCounts to OntologyHeader"
  )
  assert.ok(
    content.includes("onOpenIssuesSheet"),
    "OntologyShell must pass onOpenIssuesSheet to OntologyHeader"
  )
})
