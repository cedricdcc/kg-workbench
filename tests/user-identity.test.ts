import assert from "node:assert/strict"
import { test } from "node:test"
import { isValidUserId, USER_ID_COOKIE_NAME } from "../src/server/user-identity"

test("USER_ID_COOKIE_NAME is defined", () => {
  assert.equal(USER_ID_COOKIE_NAME, "kg-workbench-user-id")
})

test("isValidUserId validates standard UUID v4 format", () => {
  assert.equal(isValidUserId("123e4567-e89b-12d3-a456-426614174000"), true)
  assert.equal(isValidUserId("a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d"), true)
  assert.equal(isValidUserId("invalid-uuid"), false)
  assert.equal(isValidUserId(""), false)
  assert.equal(isValidUserId(123 as unknown as string), false)
})
