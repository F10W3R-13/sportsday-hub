import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/drive/sync/route'
import { syncDriveFiles, createServiceClient } from '@/lib/drive/sync'

vi.mock('@/lib/drive/sync', () => ({
  syncDriveFiles: vi.fn(),
  createServiceClient: vi.fn(),
}))

const jsonRequest = (body: unknown, raw = false) =>
  new Request('http://localhost/api/drive/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  }) as unknown as NextRequest

describe('POST /api/drive/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(syncDriveFiles).mockResolvedValue({ success: true, syncedTeams: 2, totalFiles: 7 })
  })

  it('teamId·force를 전달해 동기화 결과 반환', async () => {
    const res = await POST(jsonRequest({ teamId: 'budget', force: true }))
    expect(syncDriveFiles).toHaveBeenCalledWith('budget', true)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, syncedTeams: 2, totalFiles: 7 })
  })

  it('드라이브 미연결 시 401 + drive_not_connected', async () => {
    vi.mocked(syncDriveFiles).mockResolvedValue({
      success: false, syncedTeams: 0, totalFiles: 0, error: 'not_connected',
    })
    const res = await POST(jsonRequest({}))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'drive_not_connected' })
  })

  it('save_folders 액션 — 매핑 저장 후 강제 동기화', async () => {
    const eq = vi.fn().mockResolvedValue({})
    const update = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ update })
    vi.mocked(createServiceClient).mockReturnValue({ from } as never)

    const res = await POST(
      jsonRequest({
        action: 'save_folders',
        updates: [{ id: 'budget', drive_folder_id: 'folder-1' }],
      })
    )

    expect(from).toHaveBeenCalledWith('teams')
    expect(update).toHaveBeenCalledWith({ drive_folder_id: 'folder-1' })
    expect(eq).toHaveBeenCalledWith('id', 'budget')
    expect(syncDriveFiles).toHaveBeenCalledWith(undefined, true)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ saved: true, success: true, syncedTeams: 2, totalFiles: 7 })
  })

  it('잘못된 JSON 본문은 빈 객체로 처리 (전체 동기화 폴백)', async () => {
    const res = await POST(jsonRequest('not-json', true))
    expect(syncDriveFiles).toHaveBeenCalledWith(undefined, false)
    expect(res.status).toBe(200)
  })

  it('동기화 중 예외 시 500 sync_failed', async () => {
    vi.mocked(syncDriveFiles).mockRejectedValue(new Error('boom'))
    const res = await POST(jsonRequest({}))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'sync_failed' })
  })
})
