import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("DocumentFiltersToolbar is decomposed into subcomponents under 300 LOC", () => {
  const baseDir = path.resolve(
    process.cwd(),
    "src/features/documents/components/shared/document-filters-toolbar"
  )

  const mainFile = path.join(baseDir, "document-filters-toolbar.tsx")
  const compactFile = path.join(baseDir, "document-filters-toolbar-compact.tsx")
  const expandedFile = path.join(
    baseDir,
    "document-filters-toolbar-expanded.tsx"
  )
  const hookFile = path.join(baseDir, "hooks/use-document-filter-data.ts")

  assert.ok(fs.existsSync(mainFile), "document-filters-toolbar.tsx must exist")
  assert.ok(
    fs.existsSync(compactFile),
    "document-filters-toolbar-compact.tsx must exist"
  )
  assert.ok(
    fs.existsSync(expandedFile),
    "document-filters-toolbar-expanded.tsx must exist"
  )
  assert.ok(fs.existsSync(hookFile), "use-document-filter-data.ts must exist")

  const countLines = (filePath: string) =>
    fs.readFileSync(filePath, "utf-8").split("\n").length

  assert.ok(
    countLines(mainFile) < 180,
    `main toolbar must be < 180 LOC, was ${countLines(mainFile)}`
  )
  assert.ok(
    countLines(compactFile) < 300,
    `compact toolbar must be < 300 LOC, was ${countLines(compactFile)}`
  )
})
