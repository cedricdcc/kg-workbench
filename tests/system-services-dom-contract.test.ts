import assert from "node:assert/strict"
import { test } from "node:test"
import { formatComposeCommand } from "../src/features/settings/components/services-section/commands"

test("formatComposeCommand outputs correct docker compose invocation per profile", () => {
  assert.equal(
    formatComposeCommand("reasoner"),
    "bash deploy/scripts/deploy.sh postgres up --profile reasoner"
  )
  assert.equal(
    formatComposeCommand("tabular"),
    "bash deploy/scripts/deploy.sh postgres up --profile tabular"
  )
  assert.equal(
    formatComposeCommand("analyst"),
    "bash deploy/scripts/deploy.sh postgres up --profile analyst"
  )
  assert.equal(
    formatComposeCommand("full"),
    "bash deploy/scripts/deploy.sh postgres up --profile full"
  )
})
