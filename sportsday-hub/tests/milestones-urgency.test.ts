import { describe, it, expect } from 'vitest'
import { sortByUrgency, startOfToday } from '@/lib/milestones-urgency'
import type { Milestone, MilestoneCategory, TeamId } from '@/lib/types/models'

// 테스트 기준일: 2026-08-09 자정
const NOW = new Date('2026-08-09T14:30:00')

// 테스트용 최소 Milestone 팩토리. sortByUrgency는 date, completed만 본다.
function milestone(
  id: string,
  date: string,
  completed: boolean
): Milestone {
  return {
    id,
    date,
    title: 'x',
    team_id: null,
    category: 'deliverable' as MilestoneCategory,
    completed,
    depends_on: null,
    sort_order: 0,
  }
}

describe('startOfToday', () => {
  it('시분초를 00:00:00으로 만든다', () => {
    const result = startOfToday(NOW)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getDate()).toBe(9)
  })
})

describe('sortByUrgency', () => {
  it('빈 배열은 빈 배열', () => {
    expect(sortByUrgency([], NOW)).toEqual([])
  })

  it('완료된 마일스톤은 제외', () => {
    const ms = [
      milestone('a', '2026-08-09', true),
      milestone('b', '2026-08-09', false),
    ]
    const result = sortByUrgency(ms, NOW)
    expect(result.map((r) => r.milestone.id)).toEqual(['b'])
  })

  it('overdue(지연)가 가장 위에, 오래된 순', () => {
    const ms = [
      milestone('old', '2026-08-01', false), // 8일 전
      milestone('older', '2026-07-25', false), // 15일 전
    ]
    const result = sortByUrgency(ms, NOW)
    expect(result.map((r) => r.tier)).toEqual(['overdue', 'overdue'])
    expect(result.map((r) => r.milestone.id)).toEqual(['older', 'old'])
    expect(result[0].daysFromToday).toBe(-15)
  })

  it('today(오늘)는 overdue 다음', () => {
    const ms = [
      milestone('overdue', '2026-08-07', false),
      milestone('today', '2026-08-09', false),
      milestone('future', '2026-08-13', false),
    ]
    const result = sortByUrgency(ms, NOW)
    expect(result.map((r) => r.tier)).toEqual(['overdue', 'today', 'upcoming'])
    expect(result.map((r) => r.milestone.id)).toEqual([
      'overdue',
      'today',
      'future',
    ])
  })

  it('upcoming은 가까운 순', () => {
    const ms = [
      milestone('far', '2026-09-19', false), // 41일 후
      milestone('near', '2026-08-13', false), // 4일 후
      milestone('mid', '2026-08-16', false), // 7일 후
    ]
    const result = sortByUrgency(ms, NOW)
    expect(result.map((r) => r.milestone.id)).toEqual(['near', 'mid', 'far'])
  })

  it('오늘 자정 기준: 2026-08-09 당일은 시간과 무관하게 today', () => {
    // 오늘 새벽에 봐도, 오늘 밤에 봐도 8/9는 today
    const ms = [milestone('today', '2026-08-09', false)]
    const morning = new Date('2026-08-09T06:00:00')
    const night = new Date('2026-08-09T23:59:00')
    expect(sortByUrgency(ms, morning)[0].tier).toBe('today')
    expect(sortByUrgency(ms, night)[0].tier).toBe('today')
  })

  it('전체 순서: overdue(오래된순) → today → upcoming(가까운순)', () => {
    const ms = [
      milestone('u1', '2026-09-19', false),
      milestone('today2', '2026-08-09', false),
      milestone('over2', '2026-08-05', false),
      milestone('u2', '2026-08-13', false),
      milestone('today1', '2026-08-09', false),
      milestone('over1', '2026-08-07', false),
    ]
    const result = sortByUrgency(ms, NOW)
    expect(result.map((r) => r.milestone.id)).toEqual([
      'over2', // 8/5 (4일 전, 가장 오래된 지연)
      'over1', // 8/7 (2일 전)
      'today2', // 8/9 오늘 (sort_order 동일 → 안정 정렬)
      'today1', // 8/9 오늘
      'u2', // 8/13 (4일 후)
      'u1', // 9/19 (41일 후)
    ])
  })

  it('원본 배열을 변경하지 않는다', () => {
    const ms = [
      milestone('a', '2026-08-13', false),
      milestone('b', '2026-08-09', false),
    ]
    const original = [...ms]
    sortByUrgency(ms, NOW)
    expect(ms.map((m) => m.id)).toEqual(original.map((m) => m.id))
  })
})
