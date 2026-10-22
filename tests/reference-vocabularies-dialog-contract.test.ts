import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("ReferenceVocabulariesDialog integrates EndpointTesterTab and 4 tabs", () => {
  const dialogPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx"
  )
  assert.ok(fs.existsSync(dialogPath), "reference-vocabularies-dialog.tsx must exist")
  const content = fs.readFileSync(dialogPath, "utf-8")

  assert.ok(content.includes("EndpointTesterTab"))
  assert.ok(content.includes('value="tester"'))
  assert.ok(content.includes("Endpoint Tester & Registries"))
})

test("VocabularySearchTab includes multi-registry filters and resilient indicators", () => {
  const searchTabPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/vocabulary-search-tab.tsx"
  )
  assert.ok(fs.existsSync(searchTabPath), "vocabulary-search-tab.tsx must exist")
  const content = fs.readFileSync(searchTabPath, "utf-8")

  assert.ok(content.includes("searchAllRegistries"))
  assert.ok(content.includes("failedProviders"))
  assert.ok(content.includes("BARTOC"))
  assert.ok(content.includes("OLS4"))
})
