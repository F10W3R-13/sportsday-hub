import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverTeamFolders } from '@/lib/drive/sync'
import { createDriveClient } from '@/lib/drive/client'

vi.mock('@/lib/drive/client', () => ({ createDriveClient: vi.fn() }))
vi.mock('googleapis', () => ({ google: { drive: vi.fn() } }))

function stubFolders(folders: { id: string; name: string }[]) {
  vi.mocked(createDriveClient).mockResolvedValue({
    drive: { files: { list: vi.fn().mockResolvedValue({ data: { files: folders } }) } },
    email: 'test@example.com',
  } as unknown as Awaited<ReturnType<typeof createDriveClient>>)
}

describe('lib/drive/sync — discoverTeamFolders 키워드 자동 매핑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('한글 키워드로 5개 팀 폴더 매핑', async () => {
    stubFolders([
      { id: 'f-plan', name: '1팀_기획' },
      { id: 'f-game', name: '게임 구성안' },
      { id: 'f-budget', name: '예산안 최종' },
      { id: 'f-ex', name: '교환담당' },
      { id: 'f-time', name: '타임라인 & 인원' },
    ])
    const { mapping } = await discoverTeamFolders('root-1')
    expect(mapping).toEqual({
      management: 'f-plan',
      content: 'f-game',
      budget: 'f-budget',
      exchange: 'f-ex',
      timeline: 'f-time',
    })
  })

  it('영문 폴더명은 매칭 안 됨 — 키워드가 전부 한글이라 현재 동작 문서화', async () => {
    stubFolders([{ id: 'f-tl', name: 'TIMELINE 최종' }])
    const { mapping } = await discoverTeamFolders('root-1')
    expect(mapping.timeline).toBeNull()
  })

  it('키워드에 해당하지 않는 팀은 null', async () => {
    stubFolders([{ id: 'f-etc', name: '회의록' }])
    const { mapping } = await discoverTeamFolders('root-1')
    expect(mapping.management).toBeNull()
    expect(mapping.content).toBeNull()
    expect(mapping.budget).toBeNull()
  })

  it('폴더 하나가 여러 팀 키워드에 걸리면 둘 다 매핑됨 (현재 동작 문서화)', async () => {
    stubFolders([{ id: 'f-both', name: '전체 예산' }])
    const { mapping } = await discoverTeamFolders('root-1')
    expect(mapping.management).toBe('f-both') // '전체'
    expect(mapping.budget).toBe('f-both') // '예산'
  })

  it('드라이브 미연결 시 에러', async () => {
    vi.mocked(createDriveClient).mockResolvedValue(null as never)
    await expect(discoverTeamFolders('root-1')).rejects.toThrow('Drive not connected')
  })

  it('결과에 하위 폴더 전체 목록 포함 (매핑 안 된 폴더도)', async () => {
    const folders = [
      { id: 'f-budget', name: '예산' },
      { id: 'f-etc', name: '회의록' },
    ]
    stubFolders(folders)
    const { allFolders } = await discoverTeamFolders('root-1')
    expect(allFolders).toEqual(folders)
  })
})
