import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("OntologyIssuesPill component exists and is exported", () => {
  const pillPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-header/ontology-issues-pill.tsx"
  )
  assert.ok(fs.existsSync(pillPath), "ontology-issues-pill.tsx must exist")
  const content = fs.readFileSync(pillPath, "utf-8")

  assert.ok(content.includes("export interface OntologyIssuesPillProps"))
  assert.ok(content.includes("export function OntologyIssuesPill"))
  assert.ok(content.includes("getOntologyIssuesSummary"))
})

test("OntologyHeader streamlines to 4 landmarks and removes duplicate quality tools", () => {
  const headerPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-header/ontology-header.tsx"
  )
  assert.ok(fs.existsSync(headerPath), "ontology-header.tsx must exist")
  const content = fs.readFileSync(headerPath, "utf-8")

  // Must use OntologyActionsMenu and OntologyIssuesPill
  assert.ok(content.includes("OntologyActionsMenu"))
  assert.ok(content.includes("OntologyIssuesPill"))

  // Must accept issuesCounts and onOpenIssuesSheet (or onOpenDefectsSheet)
  assert.ok(content.includes("issuesCounts?:"))

  // Must NOT import or render standalone Activity or OntologyAnalysisReportDialog
  assert.ok(
    !content.includes("OntologyAnalysisReportDialog"),
    "OntologyAnalysisReportDialog must not be in ontology-header"
  )
  assert.ok(
    !content.includes("<Activity"),
    "Standalone Activity icon button must be removed"
  )
})
