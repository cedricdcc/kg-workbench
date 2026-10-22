import assert from "node:assert/strict"
import { test } from "node:test"
import { registryEndpointSnapshots } from "../src/server/db/schema"
import { type SupportedProvider } from "../src/features/settings/server/types"

test("registryEndpointSnapshots schema exposes expected columns", () => {
  assert.ok(registryEndpointSnapshots.id)
  assert.ok(registryEndpointSnapshots.provider_id)
  assert.ok(registryEndpointSnapshots.endpoint_url)
  assert.ok(registryEndpointSnapshots.status_code)
  assert.ok(registryEndpointSnapshots.latency_ms)
  assert.ok(registryEndpointSnapshots.response_payload)
  assert.ok(registryEndpointSnapshots.detected_vocab_count)
})

test("SupportedProvider includes registry keys", () => {
  const p1: SupportedProvider = "bioportal"
  const p2: SupportedProvider = "agroportal"
  const p3: SupportedProvider = "ecoportal"
  assert.equal(p1, "bioportal")
  assert.equal(p2, "agroportal")
  assert.equal(p3, "ecoportal")
})
