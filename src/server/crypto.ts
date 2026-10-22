import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH_BYTES = 12

function getMasterKey(): Buffer {
  const seed =
    process.env.SETTINGS_ENCRYPTION_SECRET ||
    process.env.APP_PASSWORD ||
    "kg-workbench-local-dev-seed"

  return crypto.createHash("sha256").update(seed).digest()
}

export interface EncryptedSecretPayload {
  ciphertext: string
  iv: string
  tag: string
}

/**
 * Encrypt a plaintext secret at rest using AES-256-GCM.
 */
export function encryptSecret(secret: string): EncryptedSecretPayload {
  if (typeof secret !== "string") {
    throw new TypeError("Secret to encrypt must be a string.")
  }

  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH_BYTES)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let ciphertext = cipher.update(secret, "utf8", "hex")
  ciphertext += cipher.final("hex")

  const tag = cipher.getAuthTag().toString("hex")

  return {
    ciphertext,
    iv: iv.toString("hex"),
    tag,
  }
}

/**
 * Decrypt an AES-256-GCM encrypted payload back to plaintext.
 * Throws if the ciphertext or authentication tag was tampered with.
 */
export function decryptSecret(
  ciphertext: string,
  ivHex: string,
  tagHex: string
): string {
  if (!ciphertext || !ivHex || !tagHex) {
    throw new Error("Missing encrypted components for decryption.")
  }

  const key = getMasterKey()
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(ciphertext, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}
