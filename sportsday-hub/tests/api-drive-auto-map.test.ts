import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { POST } from '@/app/api/drive/auto-map/route'
import { discoverTeamFolders, syncDriveFiles, createServiceClient } from '@/lib/drive/sync'

vi.mock('@/lib/drive/sync', () => ({
  discoverTeamFolders: vi.fn(),
  syncDriveFiles: vi.fn(),
  createServiceClient: vi.fn(),
}))

const jsonRequest = (body: unknown) =>
  new Request('http://localhost/api/drive/auto-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest

function stubSupabase() {
  const eq = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ update })
  vi.mocked(createServiceClient).mockReturnValue({ from } as never)
  return { from, update, eq }
}

describe('POST /api/drive/auto-map', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(discoverTeamFolders).mockResolvedValue({
      mapping: { management: null, content: 'c1', budget: null, exchange: null, timeline: 't1' },
      allFolders: [
        { id: 'c1', name: '컨텐츠' },
        { id: 't1', name: '타임라인' },
      ],
    })
    vi.mocked(syncDriveFiles).mockResolvedValue({ success: true, syncedTeams: 2, totalFiles: 5 })
  })

  it('URL에서 폴더 ID 추출 → 매핑 저장 → 즉시 동기화', async () => {
    const supa = stubSupabase()
    const res = await POST(
      jsonRequest({ parentFolderUrl: 'https://drive.google.com/drive/folders/ROOT-1_abc' })
    )

    expect(discoverTeamFolders).toHaveBeenCalledWith('ROOT-1_abc')
    // management(상위 폴더 강제 매핑) + content + timeline = 3건
    expect(supa.update).toHaveBeenCalledTimes(3)
    expect(syncDriveFiles).toHaveBeenCalledWith(undefined, true)

    const body = await res.json()
    expect(body.mapping.management).toBe('ROOT-1_abc')
    expect(body.mapping.content).toBe('c1')
    expect(body.allFolders).toHaveLength(2)
    expect(body.sync).toEqual({ success: true, syncedTeams: 2, totalFiles: 5 })
  })

  it('folders/ 패턴 없는 URL은 400 invalid_url', async () => {
    const res = await POST(jsonRequest({ parentFolderUrl: 'https://example.com/x' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_url' })
    expect(discoverTeamFolders).not.toHaveBeenCalled()
  })

  it('매핑 중 예외 시 500 auto_map_failed', async () => {
    vi.mocked(discoverTeamFolders).mockRejectedValue(new Error('drive down'))
    const res = await POST(
      jsonRequest({ parentFolderUrl: 'https://drive.google.com/drive/folders/ROOT' })
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'auto_map_failed' })
  })
})
