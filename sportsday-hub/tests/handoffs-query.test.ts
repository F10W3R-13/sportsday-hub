import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getHandoffs } from '@/lib/queries/handoffs'

type Row = Record<string, unknown>

// handoffs/teams/checklist_items 3테이블 mock. 각 체인은 쿼리 코드의 호출 순서와 정확히 일치.
function setupSupabase(opts: { handoffs?: Row[]; teams?: Row[]; checklist?: Row[] }) {
  const handoffsIs = vi.fn().mockResolvedValue({ data: opts.handoffs ?? [], error: null })
  const teamsIs = vi.fn().mockResolvedValue({ data: opts.teams ?? [] })
  const checklistIs = vi.fn().mockResolvedValue({ data: opts.checklist ?? [] })

  const from = vi.fn((table: string) => {
    if (table === 'handoffs') return { select: vi.fn().mockReturnValue({ is: handoffsIs }) }
    if (table === 'teams') return { select: vi.fn().mockReturnValue({ is: teamsIs }) }
    return { select: vi.fn().mockReturnValue({ is: checklistIs }) }
  })
  vi.mocked(createClient).mockResolvedValue({ from } as never)
  return { handoffsIs, teamsIs, checklistIs }
}

const HANDOFF_ROW: Row = {
  id: 'h-1',
  from_team_id: 'content',
  to_team_id: null,
  to_external: '홍보부',
  title: '카드뉴스 인계물',
  due_date: '2026-08-30',
  completed: false,
  checklist_item_id: 'ci-1',
  sort_order: 1,
  created_at: '2026-08-18T00:00:00Z',
  updated_at: '2026-08-18T00:00:00Z',
  deleted_at: null,
}

const TEAMS: Row[] = [
  { id: 'content', name: '컨텐츠팀', color: '#ec4899', icon: 'Gamepad2' },
  { id: 'budget', name: '예산팀', color: '#10b981', icon: 'Coins' },
]

const CHECKLIST: Row[] = [{ id: 'ci-1', team_id: 'exchange', content: '홍보부 인계 (8/18, 8/30)' }]

describe('getHandoffs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 메타·체크리스트 조인 병합', async () => {
    setupSupabase({ handoffs: [HANDOFF_ROW], teams: TEAMS, checklist: CHECKLIST })
    const items = await getHandoffs()
    expect(items).toHaveLength(1)
    expect(items[0].from_team.name).toBe('컨텐츠팀')
    expect(items[0].to_team).toBeNull()
    expect(items[0].checklist_content).toBe('홍보부 인계 (8/18, 8/30)')
    expect(items[0].checklist_team_id).toBe('exchange')
  })

  it('링크된 체크리스트가 없으면(삭제 등) checklist 필드 null — 행은 유지', async () => {
    setupSupabase({ handoffs: [HANDOFF_ROW], teams: TEAMS, checklist: [] })
    const items = await getHandoffs()
    expect(items[0].checklist_content).toBeNull()
    expect(items[0].checklist_team_id).toBeNull()
  })

  it('팀 매핑 불능이면 회색 폴백 (id는 원본 유지)', async () => {
    setupSupabase({ handoffs: [HANDOFF_ROW], teams: [], checklist: [] })
    const items = await getHandoffs()
    expect(items[0].from_team).toEqual({
      id: 'content',
      name: '알 수 없음',
      color: '#94a3b8',
    })
  })

  it('deleted_at is null 위임', async () => {
    const { handoffsIs } = setupSupabase({ handoffs: [], teams: [], checklist: [] })
    await getHandoffs()
    expect(handoffsIs).toHaveBeenCalledWith('deleted_at', null)
  })

  it('쿼리 에러면 throw', async () => {
    const handoffsIs = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnValue({ is: handoffsIs }),
    }))
    vi.mocked(createClient).mockResolvedValue({ from } as never)
    await expect(getHandoffs()).rejects.toEqual({ message: 'boom' })
  })
})
