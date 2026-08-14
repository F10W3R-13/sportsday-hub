import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/google-connect/route'
import { getAuthUrl } from '@/lib/drive/client'

vi.mock('@/lib/drive/client', () => ({ getAuthUrl: vi.fn() }))

describe('GET /api/auth/google-connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('생성된 인증 URL로 리다이렉트', async () => {
    vi.mocked(getAuthUrl).mockReturnValue('https://accounts.google.com/o/oauth2/auth?client_id=x')
    const res = await GET()
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth?client_id=x')
  })

  it('URL 생성 실패 시 설정 페이지로 에러 리다이렉트', async () => {
    vi.mocked(getAuthUrl).mockImplementation(() => {
      throw new Error('missing client id')
    })
    const res = await GET()
    expect(res.headers.get('location')).toMatch(/[?&]error=oauth_failed/)
  })
})
