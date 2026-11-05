import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("getLatestReasonerRunQuery returns null or valid reasoner job payload", async () => {
  const { getLatestReasonerRunQuery } =
    await import("../src/features/tabular/server/queries/get-latest-reasoner-run")
  const result = await getLatestReasonerRunQuery(
    "00000000-0000-0000-0000-000000000000"
  )
  assert.equal(result, null)
})

test("ReasonerBrowser helper formats violation severity correctly", async () => {
  const { formatReasonerSeverityPill } =
    await import("../src/features/ontology/components/reasoner-browser/types")
  const critical = formatReasonerSeverityPill("critical")
  assert.equal(critical.label, "CRITICAL")
  const warning = formatReasonerSeverityPill("warning")
  assert.equal(warning.label, "WARNING")
})
