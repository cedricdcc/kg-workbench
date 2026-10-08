import assert from "node:assert/strict"
import { test } from "node:test"

import { generateOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"

test("generateOntologyDraft rejects empty or invalid ontology ID", async () => {
  await assert.rejects(
    () => generateOntologyDraft("", { provider: "gemini" }),
    /Ontology ID is required/
  )
})
