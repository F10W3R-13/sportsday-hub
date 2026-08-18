import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getRecentDriveFiles, getLastSyncedAt } from '@/lib/queries/drive-files'

type Row = Record<string, unknown>

// supabase 체인 mock: from('drive_files')는 select(fields) 인자로
// 최근파일 질의('*')와 lastSynced 질의('last_synced')를 구분한다.
function setupSupabase(opts: {
  files?: Row[]
  fileError?: unknown
  teams?: Row[]
  lastSyncedRow?: Row | null
}) {
  const recentLimit = vi
    .fn()
    .mockResolvedValue({ data: opts.files ?? [], error: opts.fileError ?? null })
  const recentOrder = vi.fn().mockReturnValue({ limit: recentLimit })
  const lastSyncedMaybeSingle = vi.fn().mockResolvedValue({ data: opts.lastSyncedRow ?? null })
  const lastSyncedLimit = vi.fn().mockReturnValue({ maybeSingle: lastSyncedMaybeSingle })
  const lastSyncedOrder = vi.fn().mockReturnValue({ limit: lastSyncedLimit })

  const from = vi.fn((table: string) => {
    if (table === 'teams') {
      const is = vi.fn().mockResolvedValue({ data: opts.teams ?? [] })
      return { select: vi.fn().mockReturnValue({ is }) }
    }
    return {
      select: vi.fn((fields: string) =>
        fields === 'last_synced' ? { order: lastSyncedOrder } : { order: recentOrder }
      ),
    }
  })
  vi.mocked(createClient).mockResolvedValue({ from } as never)
  return { recentOrder, recentLimit, lastSyncedOrder, lastSyncedLimit }
}

const FILE_CONTENT: Row = {
  id: 'row-1',
  team_id: 'content',
  file_id: 'g-1',
  name: '게임 규칙.pdf',
  mime_type: 'application/pdf',
  icon_link: null,
  created_time: '2026-08-17T10:00:00Z',
  modified_time: '2026-08-18T08:00:00Z',
  modified_by: '민우',
  web_view_link: 'https://drive.google.com/file/g-1',
  last_synced: '2026-08-18T09:00:00Z',
}

const TEAM_CONTENT: Row = {
  id: 'content',
  name: '컨텐츠팀',
  name_en: 'Content',
  color: '#f97316',
  icon: 'Gamepad2',
  sort_order: 1,
  mission: '',
  guideline_doc: { sections: [] },
}

describe('getRecentDriveFiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 메타를 병합해 반환', async () => {
    setupSupabase({ files: [FILE_CONTENT], teams: [TEAM_CONTENT] })
    const items = await getRecentDriveFiles(8)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('게임 규칙.pdf')
    expect(items[0].team).toEqual({
      id: 'content',
      name: '컨텐츠팀',
      color: '#f97316',
      icon: 'Gamepad2',
    })
  })

  it('팀 매핑 불능이면 회색 폴백 배지 (id는 파일의 team_id 유지)', async () => {
    setupSupabase({ files: [FILE_CONTENT], teams: [] })
    const items = await getRecentDriveFiles(8)
    expect(items[0].team).toEqual({
      id: 'content',
      name: '알 수 없음',
      color: '#94a3b8',
      icon: 'FileQuestion',
    })
  })

  it('정렬·limit을 스토리지에 위임 — modified_time desc + nulls 마지막', async () => {
    const { recentOrder, recentLimit } = setupSupabase({ files: [], teams: [] })
    await getRecentDriveFiles(8)
    expect(recentOrder).toHaveBeenCalledWith('modified_time', {
      ascending: false,
      nullsFirst: false,
    })
    expect(recentLimit).toHaveBeenCalledWith(8)
  })

  it('쿼리 에러면 throw', async () => {
    setupSupabase({ fileError: { message: 'boom' } })
    await expect(getRecentDriveFiles()).rejects.toEqual({ message: 'boom' })
  })
})

describe('getLastSyncedAt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('가장 최근 last_synced 반환', async () => {
    setupSupabase({ lastSyncedRow: { last_synced: '2026-08-18T09:00:00Z' } })
    expect(await getLastSyncedAt()).toBe('2026-08-18T09:00:00Z')
  })

  it('행이 없으면 null', async () => {
    setupSupabase({ lastSyncedRow: null })
    expect(await getLastSyncedAt()).toBeNull()
  })
})
