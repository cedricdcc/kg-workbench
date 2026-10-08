import assert from "node:assert/strict"
import { test } from "node:test"

import { applyOntologyDraft } from "../src/features/ontology/server/actions/generate-ontology"

test("applyOntologyDraft rejects missing ontology ID", async () => {
  await assert.rejects(
    () =>
      applyOntologyDraft("", {
        modules: [],
        classes: [],
        relations: [],
        cqMappings: [],
      }),
    /Ontology ID is required/
  )
})
