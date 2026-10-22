import assert from "node:assert/strict"
import { test } from "node:test"
import { formatKeyHint, getEffectiveApiKey } from "../src/server/api-keys"

test("formatKeyHint extracts last 4 characters with ellipsis", () => {
  assert.equal(formatKeyHint("AIzaSyD1234567890ABCD"), "...ABCD")
  assert.equal(formatKeyHint("short"), "...hort")
  assert.equal(formatKeyHint(""), "")
})

test("getEffectiveApiKey falls back to environment variable when no user key exists", async () => {
  const originalEnv = process.env.GEMINI_API_KEY
  try {
    process.env.GEMINI_API_KEY = "test-env-fallback-gemini-key"
    const resolved = await getEffectiveApiKey("gemini")
    assert.equal(resolved, "test-env-fallback-gemini-key")
  } finally {
    process.env.GEMINI_API_KEY = originalEnv
  }
})

test("getEffectiveApiKey returns null when no key is set anywhere", async () => {
  const originalEnv = process.env.GEMINI_API_KEY
  try {
    delete process.env.GEMINI_API_KEY
    const resolved = await getEffectiveApiKey("gemini")
    assert.equal(resolved, null)
  } finally {
    process.env.GEMINI_API_KEY = originalEnv
  }
})
