import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  getMilestones,
  getMilestonesByTeam,
  getMilestoneById,
} from '@/lib/queries/milestones'

type Row = Record<string, unknown>

// milestones 쿼리 mock.
// 체인은 쿼리 코드의 호출 순서(select → [eq] → is → order(date) → order(sort_order))와 정확히 일치.
function setupSupabase(opts: { rows?: Row[] }) {
  const secondOrder = vi.fn().mockResolvedValue({ data: opts.rows ?? [], error: null })
  const firstOrder = vi.fn().mockReturnValue({ order: secondOrder })
  const isFn = vi.fn().mockReturnValue({ order: firstOrder })
  const from = vi.fn(() => ({ select: vi.fn().mockReturnValue({ is: isFn }) }))
  vi.mocked(createClient).mockResolvedValue({ from } as never)
  return { isFn, firstOrder, secondOrder }
}

const ROW_A: Row = {
  id: 'm-1',
  date: '2026-09-01',
  title: '작업 A',
  team_id: 'exchange',
  category: 'deliverable',
  completed: false,
  depends_on: null,
  sort_order: 1,
}

describe('getMilestones / getMilestonesByTeam / getMilestoneById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deleted_at is null 위임 + date(nulls 마지막)·sort_order 정렬 체인', async () => {
    const { isFn, firstOrder } = setupSupabase({ rows: [ROW_A] })
    const items = await getMilestones()
    expect(isFn).toHaveBeenCalledWith('deleted_at', null)
    expect(firstOrder).toHaveBeenCalledWith('date', { nullsFirst: false })
    expect(items.map((i) => i.id)).toEqual(['m-1'])
  })

  it('getMilestonesByTeam은 team_id 필터 추가', async () => {
    const secondOrder = vi
      .fn()
      .mockResolvedValue({ data: [{ ...ROW_A, id: 'm-t' }], error: null })
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder })
    const isFn = vi.fn().mockReturnValue({ order: firstOrder })
    const eqFn = vi.fn().mockReturnValue({ is: isFn })
    const from = vi.fn(() => ({ select: vi.fn().mockReturnValue({ eq: eqFn }) }))
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const items = await getMilestonesByTeam('exchange')
    expect(eqFn).toHaveBeenCalledWith('team_id', 'exchange')
    expect(items.map((i) => i.id)).toEqual(['m-t'])
  })

  it('data가 비면 빈 배열 반환', async () => {
    setupSupabase({ rows: [] })
    expect(await getMilestones()).toEqual([])
  })

  it('쿼리 에러면 throw', async () => {
    const secondOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder })
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({ order: firstOrder }),
      }),
    }))
    vi.mocked(createClient).mockResolvedValue({ from } as never)
    await expect(getMilestones()).rejects.toEqual({ message: 'boom' })
  })

  it('getMilestoneById는 id 필터 + maybeSingle, 미발견 시 null', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: ROW_A, error: null })
    const isFn = vi.fn().mockReturnValue({ maybeSingle })
    const eqFn = vi.fn().mockReturnValue({ is: isFn })
    const from = vi.fn(() => ({ select: vi.fn().mockReturnValue({ eq: eqFn }) }))
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    expect(await getMilestoneById('m-1')).toEqual(ROW_A)
    expect(eqFn).toHaveBeenCalledWith('id', 'm-1')

    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await getMilestoneById('nope')).toBeNull()
  })
})
