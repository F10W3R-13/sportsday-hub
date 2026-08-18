import { describe, it, expect } from 'vitest'
import {
  handoffUrgency,
  sortHandoffs,
  handoffDirectionLabel,
  validateHandoffTarget,
  parseHandoffToFilter,
  latestFileByTeamMap,
} from '@/lib/handoff'
import type { HandoffItem } from '@/lib/types/models'

const NOW = new Date('2026-08-18T12:00:00')

// 테스트용 HandoffItem 팩토리 — 필수 필드만 교체해 사용
function item(over: Partial<HandoffItem> = {}): HandoffItem {
  return {
    id: 'h-1',
    from_team_id: 'content',
    to_team_id: 'budget',
    to_external: null,
    title: '물품 리스트',
    due_date: null,
    completed: false,
    checklist_item_id: null,
    sort_order: 0,
    from_team: { id: 'content', name: '컨텐츠팀', color: '#ec4899' },
    to_team: { id: 'budget', name: '예산팀', color: '#10b981' },
    checklist_content: null,
    checklist_team_id: null,
    ...over,
  }
}

describe('handoffUrgency — 오늘 자정 기준', () => {
  it('어제 due면 overdue', () => {
    expect(handoffUrgency('2026-08-17', false, NOW)).toBe('overdue')
  })
  it('오늘·3일 후 due면 due_soon', () => {
    expect(handoffUrgency('2026-08-18', false, NOW)).toBe('due_soon')
    expect(handoffUrgency('2026-08-21', false, NOW)).toBe('due_soon')
  })
  it('4일 후 due면 scheduled', () => {
    expect(handoffUrgency('2026-08-22', false, NOW)).toBe('scheduled')
  })
  it('due 없음이면 no_due', () => {
    expect(handoffUrgency(null, false, NOW)).toBe('no_due')
  })
  it('완료면 due 무시하고 scheduled', () => {
    expect(handoffUrgency('2026-08-17', true, NOW)).toBe('scheduled')
    expect(handoffUrgency(null, true, NOW)).toBe('scheduled')
  })
})

describe('sortHandoffs', () => {
  it('미완료 우선, 티어순(overdue→due_soon→scheduled→no_due), 티어 내 due 오름차순', () => {
    const sorted = sortHandoffs(
      [
        item({ id: 'a', due_date: '2026-08-20' }),                  // due_soon
        item({ id: 'b', due_date: '2026-08-17' }),                  // overdue
        item({ id: 'c', due_date: null }),                          // no_due
        item({ id: 'd', due_date: '2026-08-30' }),                  // scheduled
      ],
      NOW
    )
    expect(sorted.map((h) => h.id)).toEqual(['b', 'a', 'd', 'c'])
  })
  it('티어 내 같으면 due 오름차순', () => {
    const sorted = sortHandoffs(
      [item({ id: 'x', due_date: '2026-08-19' }), item({ id: 'y', due_date: '2026-08-18' })],
      NOW
    )
    expect(sorted.map((h) => h.id)).toEqual(['y', 'x'])
  })
  it('완료는 전부 뒤로, updated_at 내림차순', () => {
    const sorted = sortHandoffs(
      [
        item({ id: 'open', due_date: '2026-09-01' }),
        item({ id: 'done-old', completed: true, updated_at: '2026-08-10T00:00:00Z' }),
        item({ id: 'done-new', completed: true, updated_at: '2026-08-17T00:00:00Z' }),
      ],
      NOW
    )
    expect(sorted.map((h) => h.id)).toEqual(['open', 'done-new', 'done-old'])
  })
})

describe('handoffDirectionLabel', () => {
  it('내부 → 내부', () => {
    expect(handoffDirectionLabel(item())).toBe('컨텐츠팀 → 예산팀')
  })
  it('내부 → 외부', () => {
    expect(
      handoffDirectionLabel(
        item({ to_team_id: null, to_team: null, to_external: '홍보부' })
      )
    ).toBe('컨텐츠팀 → 홍보부')
  })
})

describe('validateHandoffTarget', () => {
  it('팀만/외부만 유효 (null 반환)', () => {
    expect(validateHandoffTarget('budget', null)).toBeNull()
    expect(validateHandoffTarget(null, '홍보부')).toBeNull()
  })
  it('둘 다 있으면 오류', () => {
    expect(validateHandoffTarget('budget', '홍보부')).toContain('하나만')
  })
  it('둘 다 없으면 오류', () => {
    expect(validateHandoffTarget(null, null)).toContain('받는 쪽')
  })
  it('외부명이 공백이면 없는 것으로 취급', () => {
    expect(validateHandoffTarget(null, '   ')).toContain('받는 쪽')
  })
})

describe('parseHandoffToFilter — ?to= 파라미터', () => {
  it('유효 팀 id면 그대로', () => {
    expect(parseHandoffToFilter('content')).toBe('content')
  })
  it("'external'이면 'external'", () => {
    expect(parseHandoffToFilter('external')).toBe('external')
  })
  it('무효 값·null은 null (전체 폴백)', () => {
    expect(parseHandoffToFilter('hacky')).toBeNull()
    expect(parseHandoffToFilter(null)).toBeNull()
  })
})

describe('latestFileByTeamMap — 팀별 최신 파일 (입력은 modified_time desc 가정)', () => {
  it('첫 등장이 해당 팀의 최신', () => {
    const f = (team: string, name: string) =>
      ({ team_id: team, name, team: { id: team, name, color: '#000', icon: 'File' } }) as never
    const map = latestFileByTeamMap([f('content', 'a.pdf'), f('budget', 'b.xlsx'), f('content', 'c.pdf')])
    expect(map.get('content')?.name).toBe('a.pdf')
    expect(map.get('budget')?.name).toBe('b.xlsx')
    expect(map.size).toBe(2)
  })
})
