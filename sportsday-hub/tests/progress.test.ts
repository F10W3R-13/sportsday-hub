import { describe, it, expect } from 'vitest'
import { computeProgress } from '@/lib/progress'
import type { ChecklistItem } from '@/lib/types/models'

// 테스트용 최소 ChecklistItem 팩토리. computeProgress는 completed 필드만 본다.
function item(completed: boolean): ChecklistItem {
  return {
    id: crypto.randomUUID(),
    team_id: 'management',
    milestone_id: null,
    content: 'x',
    priority: null,
    completed,
    source: null,
    sort_order: 0,
  }
}

describe('computeProgress', () => {
  it('빈 배열은 0%', () => {
    expect(computeProgress([])).toEqual({ completed: 0, total: 0, percent: 0 })
  })

  it('완료율을 올림 없이 반올림한다 (2/3 → 67%)', () => {
    const items = [item(true), item(true), item(false)]
    expect(computeProgress(items)).toEqual({ completed: 2, total: 3, percent: 67 })
  })

  it('전부 완료면 100%', () => {
    const items = [item(true), item(true)]
    expect(computeProgress(items).percent).toBe(100)
  })

  it('하나도 완료 안 했으면 0%', () => {
    const items = [item(false), item(false), item(false)]
    expect(computeProgress(items).percent).toBe(0)
  })

  it('completed 필드만 본다 (다른 필드 무관)', () => {
    const items = [item(true), item(false)]
    const result = computeProgress(items)
    expect(result).toEqual({ completed: 1, total: 2, percent: 50 })
  })
})
