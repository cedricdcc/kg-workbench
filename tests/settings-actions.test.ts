import assert from "node:assert/strict"
import { test } from "node:test"
import { validateApiKeyInput } from "../src/features/settings/server/types"

test("validateApiKeyInput rejects empty or short keys", () => {
  assert.equal(validateApiKeyInput("").valid, false)
  assert.equal(validateApiKeyInput("   ").valid, false)
  assert.equal(validateApiKeyInput("short").valid, false)
  assert.equal(validateApiKeyInput("AIzaSyD-valid-length-gemini-key").valid, true)
})
