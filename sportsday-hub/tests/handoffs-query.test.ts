import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getHandoffs } from '@/lib/queries/handoffs'

type Row = Record<string, unknown>

// handoffs 단일 쿼리 + teams/milestones 임베드 mock.
// 체인은 쿼리 코드의 호출 순서(select → is)와 정확히 일치.
function setupSupabase(opts: { handoffs?: Row[] }) {
  const handoffsIs = vi.fn().mockResolvedValue({ data: opts.handoffs ?? [], error: null })

  const from = vi.fn(() => ({ select: vi.fn().mockReturnValue({ is: handoffsIs }) }))
  vi.mocked(createClient).mockResolvedValue({ from } as never)
  return { handoffsIs }
}

const TEAM_CONTENT = {
  id: 'content',
  name: '컨텐츠팀',
  color: '#ec4899',
  icon: 'Gamepad2',
}

const LINKED_ITEM = { id: 'ci-1', title: '홍보부 인계 (8/18, 8/30)', team_id: 'exchange' }

const HANDOFF_ROW: Row = {
  id: 'h-1',
  from_team_id: 'content',
  to_team_id: null,
  to_external: '홍보부',
  title: '카드뉴스 인계물',
  due_date: '2026-08-30',
  completed: false,
  item_id: 'ci-1',
  sort_order: 1,
  created_at: '2026-08-18T00:00:00Z',
  updated_at: '2026-08-18T00:00:00Z',
  deleted_at: null,
  from_team: TEAM_CONTENT,
  to_team: null,
  item: LINKED_ITEM,
}

describe('getHandoffs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('팀 메타·연결 항목 임베드 병합', async () => {
    setupSupabase({ handoffs: [HANDOFF_ROW] })
    const items = await getHandoffs()
    expect(items).toHaveLength(1)
    expect(items[0].from_team.name).toBe('컨텐츠팀')
    expect(items[0].to_team).toBeNull()
    expect(items[0].item_title).toBe('홍보부 인계 (8/18, 8/30)')
    expect(items[0].item_team_id).toBe('exchange')
  })

  it('링크된 항목이 없으면(삭제 등) item 필드 null — 행은 유지', async () => {
    setupSupabase({ handoffs: [{ ...HANDOFF_ROW, item: null }] })
    const items = await getHandoffs()
    expect(items[0].item_title).toBeNull()
    expect(items[0].item_team_id).toBeNull()
  })

  it('팀 매핑 불능이면 회색 폴백 (id는 원본 유지)', async () => {
    setupSupabase({ handoffs: [{ ...HANDOFF_ROW, from_team: null }] })
    const items = await getHandoffs()
    expect(items[0].from_team).toEqual({
      id: 'content',
      name: '알 수 없음',
      color: '#94a3b8',
    })
  })

  it('deleted_at is null 위임', async () => {
    const { handoffsIs } = setupSupabase({ handoffs: [] })
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

  it('sort_order 오름차순 클라이언트 정렬', async () => {
    setupSupabase({
      handoffs: [
        { ...HANDOFF_ROW, id: 'h-2', sort_order: 2 },
        { ...HANDOFF_ROW, id: 'h-1', sort_order: 1 },
      ],
    })
    const items = await getHandoffs()
    expect(items.map((i) => i.id)).toEqual(['h-1', 'h-2'])
  })
})
