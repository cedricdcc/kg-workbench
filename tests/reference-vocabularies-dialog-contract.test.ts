import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("ReferenceVocabulariesDialog integrates EndpointTesterTab and 4 tabs with fullscreen viewport", () => {
  const dialogPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/reference-vocabularies-dialog.tsx"
  )
  assert.ok(
    fs.existsSync(dialogPath),
    "reference-vocabularies-dialog.tsx must exist"
  )
  const content = fs.readFileSync(dialogPath, "utf-8")

  assert.ok(
    content.includes('viewport="fullscreen"'),
    "Must use DialogContent with viewport='fullscreen'"
  )
  assert.ok(content.includes("EndpointTesterTab"))
  assert.ok(content.includes('value="tester"'))
  assert.ok(content.includes("Endpoint Tester & Registries"))
  assert.ok(content.includes('value="library"'))
  assert.ok(content.includes('value="search"'))
  assert.ok(content.includes('value="upload"'))
})

test("VocabularySearchTab includes multi-registry filters, resilient indicators, and 2-pane master-detail layout", () => {
  const searchTabPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/vocabulary-search-tab.tsx"
  )
  assert.ok(
    fs.existsSync(searchTabPath),
    "vocabulary-search-tab.tsx must exist"
  )
  const content = fs.readFileSync(searchTabPath, "utf-8")

  assert.ok(content.includes("searchAllRegistries"))
  assert.ok(content.includes("failedProviders"))
  assert.ok(content.includes("BARTOC"))
  assert.ok(content.includes("OLS4"))
  assert.ok(
    content.includes("md:w-[35%]") && content.includes("md:w-[65%]"),
    "VocabularySearchTab must render master-detail 2-pane split (35% left / 65% right)"
  )
})

test("VocabularyTermsView renders 2-pane master-detail layout with term list and parent IRIs", () => {
  const termsViewPath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/vocabulary-terms-view.tsx"
  )
  assert.ok(
    fs.existsSync(termsViewPath),
    "vocabulary-terms-view.tsx must exist"
  )
  const content = fs.readFileSync(termsViewPath, "utf-8")

  assert.ok(
    content.includes("md:w-[35%]") && content.includes("md:w-[65%]"),
    "VocabularyTermsView must render 2-pane master-detail layout (35% left / 65% right)"
  )
  assert.ok(
    content.includes("parent-iris-panel") || content.includes("Parent IRIs"),
    "VocabularyTermsView must include Parent IRIs panel"
  )
  assert.ok(
    content.includes('data-slot="term-detail-pane"'),
    "VocabularyTermsView must have term-detail-pane"
  )
})

test("UploadDocumentDialog sets viewport='wide' for Step 1 and viewport='fullscreen' for Step 2", () => {
  const uploadDialogPath = path.resolve(
    process.cwd(),
    "src/features/documents/components/upload-document-dialog/upload-document-dialog.tsx"
  )
  assert.ok(
    fs.existsSync(uploadDialogPath),
    "upload-document-dialog.tsx must exist"
  )
  const content = fs.readFileSync(uploadDialogPath, "utf-8")

  assert.ok(
    content.includes('viewport={isDetailStep ? "fullscreen" : "wide"}'),
    "UploadDocumentDialog must dynamically set viewport based on isDetailStep"
  )
})
