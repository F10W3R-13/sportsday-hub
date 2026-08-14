import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken } from '@/lib/drive/crypto'

const VALID_KEY = '11'.repeat(32) // 32바이트 (hex 64자)

describe('lib/drive/crypto — 저장 토큰 AES-256-GCM', () => {
  beforeEach(() => {
    vi.stubEnv('DRIVE_ENCRYPTION_KEY', VALID_KEY)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encrypt → decrypt 왕복 복원', () => {
    const token = 'ya29.a0AfH6SMBx1234567890'
    expect(decryptToken(encryptToken(token))).toBe(token)
  })

  it('매 암호화마다 nonce가 달라 암호문이 매번 다름 (둘 다 복호 가능)', () => {
    const a = encryptToken('same-token')
    const b = encryptToken('same-token')
    expect(a).not.toBe(b)
    expect(decryptToken(a)).toBe('same-token')
    expect(decryptToken(b)).toBe('same-token')
  })

  it('다른 키로 복호화 시 실패 (GCM 인증 태그)', () => {
    const sealed = encryptToken('secret-token')
    vi.stubEnv('DRIVE_ENCRYPTION_KEY', '22'.repeat(32))
    expect(() => decryptToken(sealed)).toThrow()
  })

  it('위조된 암호문은 복호화 거부', () => {
    const sealed = encryptToken('secret-token')
    const tampered = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('형식이 틀린 입력은 복호화 거부 — 가비지를 반환하지 않음', () => {
    // nonce(12B)+태그(16B)보다 짧은 입력
    expect(() => decryptToken(Buffer.alloc(13).toString('base64'))).toThrow()
    // 길이는 유효하나 내용이 쓰레기인 입력 (인증 태그 불일치)
    expect(() => decryptToken(Buffer.alloc(28).toString('base64'))).toThrow()
  })

  it('키 미설정 시 명확한 에러', () => {
    vi.stubEnv('DRIVE_ENCRYPTION_KEY', '')
    expect(() => encryptToken('x')).toThrow('DRIVE_ENCRYPTION_KEY not set')
  })

  it('32바이트가 아닌 키는 거부', () => {
    vi.stubEnv('DRIVE_ENCRYPTION_KEY', '11'.repeat(16))
    expect(() => encryptToken('x')).toThrow('32 bytes')
  })
})
