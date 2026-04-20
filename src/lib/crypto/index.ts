/**
 * @autopostlabs/crypto
 *
 * AES-256-GCM symmetric encryption for storing OAuth tokens at rest.
 * Uses Node.js built-in `crypto` — zero extra dependencies.
 *
 * Key format: 64 hex chars (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

// ─── Key loading ─────────────────────────────────────────────────────────────

function loadKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error('ENCRYPTION_KEY env var is not set')
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  return Buffer.from(hex, 'hex')
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string.
 * Returns a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Decrypts a value produced by `encrypt()`.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(ciphertext: string): string {
  const key = loadKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')

  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the value looks like an encrypted token (iv:tag:data).
 * Use to avoid double-encrypting values already stored encrypted.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p))
}

/**
 * Timing-safe string comparison — use for comparing HMAC signatures.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
