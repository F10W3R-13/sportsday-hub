import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/google-callback/route'
import { exchangeCodeForTokens, saveDriveTokens } from '@/lib/drive/client'
import { discoverTeamFolders, syncDriveFiles, createServiceClient } from '@/lib/drive/sync'

vi.mock('@/lib/drive/client', () => ({
  exchangeCodeForTokens: vi.fn(),
  saveDriveTokens: vi.fn(),
}))
vi.mock('@/lib/drive/sync', () => ({
  discoverTeamFolders: vi.fn(),
  syncDriveFiles: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('googleapis', () => ({
  google: { auth: { OAuth2: class { setCredentials() {} } } },
}))

const request = (params: Record<string, string>) =>
  new URL(`http://localhost/api/auth/google-callback?${new URLSearchParams(params)}`)

describe('GET /api/auth/google-callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'owner@example.com' }),
    }))
    vi.mocked(saveDriveTokens).mockResolvedValue()
    // 기본: 자동동기화 비활성 (DRIVE_ROOT_FOLDER_ID 없음)
    vi.stubEnv('DRIVE_ROOT_FOLDER_ID', '')
  })

  const get = (params: Record<string, string>) =>
    GET(new Request(request(params)) as unknown as Parameters<typeof GET>[0])

  it('error 파라미터 → oauth_denied 리다이렉트 (토큰 교환 안 함)', async () => {
    const res = await get({ error: 'access_denied' })
    expect(res.headers.get('location')).toMatch(/[?&]error=oauth_denied/)
    expect(exchangeCodeForTokens).not.toHaveBeenCalled()
  })

  it('code 없음 → oauth_denied', async () => {
    const res = await get({})
    expect(res.headers.get('location')).toMatch(/[?&]error=oauth_denied/)
  })

  it('refresh_token 없음 → no_refresh_token (저장 안 함)', async () => {
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({ access_token: 'at' } as never)
    const res = await get({ code: 'authcode' })
    expect(res.headers.get('location')).toMatch(/[?&]error=no_refresh_token/)
    expect(saveDriveTokens).not.toHaveBeenCalled()
  })

  it('정상 흐름 — 이메일 조회 후 토큰 저장 + connected 리다이렉트', async () => {
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
      expiry_date: 1893456000000,
    } as never)

    const res = await get({ code: 'authcode' })

    expect(saveDriveTokens).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(saveDriveTokens).mock.calls[0][0]
    expect(saved.email).toBe('owner@example.com')
    expect(saved.refreshToken).toBe('rt')
    expect(new Date(saved.expiresAt).getTime()).toBe(1893456000000)
    expect(res.headers.get('location')).toMatch(/[?&]connected=true/)
    // DRIVE_ROOT_FOLDER_ID 미설정이면 자동동기화 스킵
    expect(syncDriveFiles).not.toHaveBeenCalled()
  })

  it('DRIVE_ROOT_FOLDER_ID 설정 시 연결 직후 자동 매핑+동기화', async () => {
    vi.stubEnv('DRIVE_ROOT_FOLDER_ID', 'root-folder')
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'at', refresh_token: 'rt',
    } as never)
    vi.mocked(discoverTeamFolders).mockResolvedValue({
      mapping: { management: null, content: 'c1', budget: null, exchange: null, timeline: null },
      allFolders: [],
    })
    vi.mocked(syncDriveFiles).mockResolvedValue({ success: true, syncedTeams: 1, totalFiles: 3 })
    const eq = vi.fn().mockResolvedValue({})
    const from = vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) })
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const res = await get({ code: 'authcode' })

    expect(discoverTeamFolders).toHaveBeenCalledWith('root-folder')
    expect(syncDriveFiles).toHaveBeenCalledWith(undefined, true)
    expect(res.headers.get('location')).toMatch(/[?&]connected=true/)
  })

  it('자동동기화 실패는 연결 자체를 실패시키지 않음', async () => {
    vi.stubEnv('DRIVE_ROOT_FOLDER_ID', 'root-folder')
    vi.mocked(exchangeCodeForTokens).mockResolvedValue({
      access_token: 'at', refresh_token: 'rt',
    } as never)
    vi.mocked(discoverTeamFolders).mockRejectedValue(new Error('drive quota'))

    const res = await get({ code: 'authcode' })
    expect(res.headers.get('location')).toMatch(/[?&]connected=true/)
  })

  it('토큰 교환 실패 → callback_failed', async () => {
    vi.mocked(exchangeCodeForTokens).mockRejectedValue(new Error('bad code'))
    const res = await get({ code: 'authcode' })
    expect(res.headers.get('location')).toMatch(/[?&]error=callback_failed/)
  })
})
