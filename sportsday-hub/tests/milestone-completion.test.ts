import { describe, it, expect } from 'vitest'
import {
  shouldCompleteMilestone,
  findMilestonesToComplete,
  findMilestonesToReopen,
} from '@/lib/milestone-completion'
import type { ChecklistItem, Milestone } from '@/lib/types/models'

// 테스트용 최소 팩토리들. 함수가 보는 필드만 의미 있게.
function milestone(
  id: string,
  completed: boolean
): Milestone {
  return {
    id,
    date: '2026-08-13',
    title: 'x',
    team_id: null,
    category: 'deliverable',
    completed,
    depends_on: null,
    sort_order: 0,
  }
}

function item(
  milestoneId: string | null,
  completed: boolean
): ChecklistItem {
  return {
    id: crypto.randomUUID(),
    team_id: 'content',
    milestone_id: milestoneId,
    content: 'x',
    priority: null,
    completed,
    source: null,
    sort_order: 0,
  }
}

describe('shouldCompleteMilestone', () => {
  it('하위 체크리스트가 없으면 false (자동 완료 대상 아님)', () => {
    const m = milestone('m1', false)
    expect(shouldCompleteMilestone(m, [])).toBe(false)
  })

  it('하위 체크리스트가 전부 완료면 true', () => {
    const m = milestone('m1', false)
    const items = [item('m1', true), item('m1', true)]
    expect(shouldCompleteMilestone(m, items)).toBe(true)
  })

  it('하위 체크리스트 중 하나라도 미완료면 false', () => {
    const m = milestone('m1', false)
    const items = [item('m1', true), item('m1', false)]
    expect(shouldCompleteMilestone(m, items)).toBe(false)
  })

  it('다른 마일스톤의 체크리스트는 무시', () => {
    const m = milestone('m1', false)
    const items = [
      item('m1', true),
      item('m2', false), // 다른 마일스톤
    ]
    expect(shouldCompleteMilestone(m, items)).toBe(true)
  })

  it('milestone_id가 null인 상시 항목은 무시', () => {
    const m = milestone('m1', false)
    const items = [item('m1', true), item(null, false)] // 상시 항목
    expect(shouldCompleteMilestone(m, items)).toBe(true)
  })
})

describe('findMilestonesToComplete', () => {
  it('미완료 + 하위 전부 완료 → 자동 완료 대상', () => {
    const ms = [
      milestone('a', false),
      milestone('b', false),
    ]
    const items = [item('a', true)]
    expect(findMilestonesToComplete(ms, items).map((m) => m.id)).toEqual(['a'])
  })

  it('이미 완료된 마일스톤은 제외', () => {
    const ms = [milestone('a', true)] // 이미 완료
    const items = [item('a', true)]
    expect(findMilestonesToComplete(ms, items)).toEqual([])
  })

  it('하위가 없는 순수 마일스톤은 제외', () => {
    const ms = [milestone('a', false)]
    expect(findMilestonesToComplete(ms, [])).toEqual([])
  })

  it('하위가 하나라도 미완료면 제외', () => {
    const ms = [milestone('a', false)]
    const items = [item('a', true), item('a', false)]
    expect(findMilestonesToComplete(ms, items)).toEqual([])
  })
})

describe('findMilestonesToReopen', () => {
  it('완료된 마일스톤 + 하위 하나라도 미완료 → 롤백 대상', () => {
    const ms = [milestone('a', true)]
    const items = [item('a', true), item('a', false)]
    expect(findMilestonesToReopen(ms, items).map((m) => m.id)).toEqual(['a'])
  })

  it('완료 + 하위 전부 완료 → 롤백 대상 아님', () => {
    const ms = [milestone('a', true)]
    const items = [item('a', true), item('a', true)]
    expect(findMilestonesToReopen(ms, items)).toEqual([])
  })

  it('하위가 없는 순수 마일스톤은 롤백 대상 아님 (사용자 직접 토글한 것 존중)', () => {
    const ms = [milestone('a', true)] // 완료 + 하위 없음
    expect(findMilestonesToReopen(ms, [])).toEqual([])
  })

  it('미완료 마일스톤은 롤백 대상 아님', () => {
    const ms = [milestone('a', false)]
    const items = [item('a', false)]
    expect(findMilestonesToReopen(ms, items)).toEqual([])
  })
})
