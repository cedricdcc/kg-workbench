import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("OntologyIssuesSheet files and exports exist with correct contracts", () => {
  const issuesDir = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-issues"
  )
  assert.ok(fs.existsSync(issuesDir), "ontology-issues folder must exist")

  const files = [
    "types.ts",
    "defect-card.tsx",
    "defect-detail-inspector.tsx",
    "structural-defects-tab.tsx",
    "redundancies-tab.tsx",
    "standards-tab.tsx",
    "ontology-issues-sheet.tsx",
    "index.ts",
  ]

  for (const file of files) {
    const filePath = path.join(issuesDir, file)
    assert.ok(fs.existsSync(filePath), `${file} must exist in ontology-issues`)
  }

  const sheetContent = fs.readFileSync(
    path.join(issuesDir, "ontology-issues-sheet.tsx"),
    "utf-8"
  )
  assert.ok(sheetContent.includes("export function OntologyIssuesSheet"))
  assert.ok(sheetContent.includes("StructuralDefectsTab"))
  assert.ok(sheetContent.includes("RedundanciesTab"))
  assert.ok(sheetContent.includes("StandardsTab"))
  assert.ok(sheetContent.includes("defaultFullscreen = true"))
  assert.ok(sheetContent.includes("isFullscreen"))

  const indexContent = fs.readFileSync(
    path.join(issuesDir, "index.ts"),
    "utf-8"
  )
  assert.ok(indexContent.includes("export { OntologyIssuesSheet }"))
  assert.ok(indexContent.includes("export { DefectDetailInspector }"))
})
