import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("Endpoint tester components exist and adhere to component contract", () => {
  const dir = path.resolve(
    process.cwd(),
    "src/features/ontology/components/reference-vocabularies-dialog/endpoint-tester-tab"
  )

  const mainPath = path.join(dir, "endpoint-tester-tab.tsx")
  const presetsPath = path.join(dir, "registry-preset-selector.tsx")
  const formPath = path.join(dir, "endpoint-probe-form.tsx")
  const metricsPath = path.join(dir, "probe-metrics-bar.tsx")
  const resultsPath = path.join(dir, "probe-results-panel.tsx")
  const snapshotsPath = path.join(dir, "saved-snapshots-drawer.tsx")

  assert.ok(fs.existsSync(mainPath), "endpoint-tester-tab.tsx must exist")
  assert.ok(fs.existsSync(presetsPath), "registry-preset-selector.tsx must exist")
  assert.ok(fs.existsSync(formPath), "endpoint-probe-form.tsx must exist")
  assert.ok(fs.existsSync(metricsPath), "probe-metrics-bar.tsx must exist")
  assert.ok(fs.existsSync(resultsPath), "probe-results-panel.tsx must exist")
  assert.ok(fs.existsSync(snapshotsPath), "saved-snapshots-drawer.tsx must exist")

  const mainContent = fs.readFileSync(mainPath, "utf-8")
  assert.ok(mainContent.includes("export function EndpointTesterTab"))
  assert.ok(mainContent.includes("testRegistryEndpoint"))
  assert.ok(mainContent.includes("saveEndpointSnapshot"))

  const presetsContent = fs.readFileSync(presetsPath, "utf-8")
  assert.ok(presetsContent.includes("BARTOC"))
  assert.ok(presetsContent.includes("AgroPortal"))
  assert.ok(presetsContent.includes("BioPortal"))
  assert.ok(presetsContent.includes("OLS4"))
  assert.ok(presetsContent.includes("EU Vocabularies"))
})
