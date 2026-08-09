import { describe, it, expect } from 'vitest'
import { sortDecisions } from '@/lib/decisions-sort'
import type { Decision, DecisionStatus } from '@/lib/types/models'

// 테스트용 최소 Decision 팩토리. sortDecisions는 status, sort_order만 본다.
function decision(id: string, status: DecisionStatus, sort_order: number): Decision {
  return {
    id,
    title: 'x',
    options: [],
    status,
    current_value: null,
    decision_date: null,
    sort_order,
    notes: null,
  }
}

describe('sortDecisions', () => {
  it('빈 배열은 빈 배열', () => {
    expect(sortDecisions([])).toEqual([])
  })

  it('전부 미확정이면 sort_order 순', () => {
    const ds = [
      decision('a', 'pending', 2),
      decision('b', 'discussing', 0),
      decision('c', 'deferred', 1),
    ]
    expect(sortDecisions(ds).map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('전부 확정이면 sort_order 순', () => {
    const ds = [
      decision('a', 'confirmed', 2),
      decision('b', 'confirmed', 0),
      decision('c', 'confirmed', 1),
    ]
    expect(sortDecisions(ds).map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('혼합: 미확정 상단, 확정 하단, 각 그룹 내 sort_order 순', () => {
    const ds = [
      decision('conf-1', 'confirmed', 0),
      decision('conf-2', 'confirmed', 1),
      decision('pend-1', 'pending', 3),
      decision('pend-2', 'pending', 2),
    ]
    expect(sortDecisions(ds).map((d) => d.id)).toEqual([
      'pend-2',
      'pend-1',
      'conf-1',
      'conf-2',
    ])
  })

  it('원본 배열을 변경하지 않는다', () => {
    const ds = [
      decision('conf-1', 'confirmed', 0),
      decision('pend-1', 'pending', 1),
    ]
    const original = [...ds]
    sortDecisions(ds)
    expect(ds.map((d) => d.id)).toEqual(original.map((d) => d.id))
  })

  it('시드 D1~D7 시나리오: D1~D3 확정, D4~D7 미확정', () => {
    const ds = [
      decision('D1', 'confirmed', 0),
      decision('D2', 'confirmed', 1),
      decision('D3', 'confirmed', 2),
      decision('D4', 'deferred', 3),
      decision('D5', 'discussing', 4),
      decision('D6', 'discussing', 5),
      decision('D7', 'pending', 6),
    ]
    expect(sortDecisions(ds).map((d) => d.id)).toEqual([
      'D4',
      'D5',
      'D6',
      'D7',
      'D1',
      'D2',
      'D3',
    ])
  })
})
