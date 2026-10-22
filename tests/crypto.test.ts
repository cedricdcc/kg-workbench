import assert from "node:assert/strict"
import { test } from "node:test"
import { decryptSecret, encryptSecret } from "../src/server/crypto"

test("encryptSecret and decryptSecret roundtrip successfully", () => {
  const secret = "AIzaSyD-sample-gemini-test-key-12345"
  const encrypted = encryptSecret(secret)

  assert.ok(encrypted.ciphertext)
  assert.ok(encrypted.iv)
  assert.ok(encrypted.tag)
  assert.notEqual(encrypted.ciphertext, secret)

  const decrypted = decryptSecret(
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.tag
  )
  assert.equal(decrypted, secret)
})

test("decryptSecret throws when ciphertext or tag is tampered with", () => {
  const secret = "AIzaSyD-sample-gemini-test-key-12345"
  const encrypted = encryptSecret(secret)

  const tamperedTag = "0".repeat(encrypted.tag.length)
  assert.throws(() => {
    decryptSecret(encrypted.ciphertext, encrypted.iv, tamperedTag)
  })

  const tamperedCiphertext = "0" + encrypted.ciphertext.slice(1)
  assert.throws(() => {
    decryptSecret(tamperedCiphertext, encrypted.iv, encrypted.tag)
  })
})
