import assert from "node:assert/strict"
import { test } from "node:test"
import { userApiKeys } from "../src/server/db/schema"
import { validateApiKeyInput } from "../src/features/settings/server/types"

test("validateApiKeyInput rejects empty or short keys", () => {
  assert.equal(validateApiKeyInput("").valid, false)
  assert.equal(validateApiKeyInput("   ").valid, false)
  assert.equal(validateApiKeyInput("short").valid, false)
  assert.equal(
    validateApiKeyInput("AIzaSyD-valid-length-gemini-key").valid,
    true
  )
})

test("userApiKeys schema exposes expected columns", () => {
  assert.ok(userApiKeys.id)
  assert.ok(userApiKeys.user_id)
  assert.ok(userApiKeys.provider)
  assert.ok(userApiKeys.encrypted_key)
  assert.ok(userApiKeys.iv)
  assert.ok(userApiKeys.tag)
  assert.ok(userApiKeys.key_hint)
  assert.ok(userApiKeys.created_at)
  assert.ok(userApiKeys.updated_at)
})
