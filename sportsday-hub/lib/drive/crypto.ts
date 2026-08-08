import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes } from 'crypto'

const getKey = (): Uint8Array => {
  const keyHex = process.env.DRIVE_ENCRYPTION_KEY
  if (!keyHex) throw new Error('DRIVE_ENCRYPTION_KEY not set')
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) throw new Error('DRIVE_ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return key
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const nonce = randomBytes(12)
  const cipher = gcm(key, nonce)
  const ciphertext = cipher.encrypt(Buffer.from(plaintext))
  // nonce + ciphertext를 base64로 결합
  return Buffer.concat([nonce, ciphertext]).toString('base64')
}

export function decryptToken(combined: string): string {
  const key = getKey()
  const data = Buffer.from(combined, 'base64')
  const nonce = data.subarray(0, 12)
  const ciphertext = data.subarray(12)
  const cipher = gcm(key, nonce)
  const plaintext = cipher.decrypt(ciphertext)
  return Buffer.from(plaintext).toString()
}
