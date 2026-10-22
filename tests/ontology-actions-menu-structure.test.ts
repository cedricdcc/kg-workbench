import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("OntologyActionsMenu defines expected props interface and component structure", () => {
  const actionsMenuPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-header/ontology-actions-menu.tsx"
  )
  assert.ok(
    fs.existsSync(actionsMenuPath),
    "ontology-actions-menu.tsx must exist"
  )
  const content = fs.readFileSync(actionsMenuPath, "utf-8")

  // Check required interface props
  assert.ok(content.includes("export interface OntologyActionsMenuProps"))
  assert.ok(content.includes("onOpenOntologyDetails: () => void"))
  assert.ok(content.includes("onOpenVocabularies: () => void"))
  assert.ok(content.includes("onImport: () => void"))
  assert.ok(content.includes("onExportJson: () => void"))
  assert.ok(content.includes("onExportOwl: () => void"))
  assert.ok(content.includes("onDelete: () => void"))

  // Check export
  assert.ok(content.includes("export function OntologyActionsMenu"))
})

test("create-import-actions re-exports OntologyActionsMenu for backwards compatibility", () => {
  const legacyPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-header/create-import-actions.tsx"
  )
  assert.ok(fs.existsSync(legacyPath), "create-import-actions.tsx must exist")
  const content = fs.readFileSync(legacyPath, "utf-8")

  assert.ok(content.includes("OntologyActionsMenu as CreateImportActions"))
})
