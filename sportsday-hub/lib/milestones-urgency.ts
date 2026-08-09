import type { Milestone } from '@/lib/types/models'

/**
 * 마일스톤 시급함 분류.
 * - overdue: 미완료 + 날짜가 오늘 자정 이전 (지연)
 * - today: 미완료 + 오늘 (자정 ~ 내일 자정)
 * - upcoming: 미완료 + 오늘 이후
 * - 완료 항목은 분류에서 제외
 */
export type UrgencyTier = 'overdue' | 'today' | 'upcoming'

export interface MilestoneWithUrgency {
  milestone: Milestone
  tier: UrgencyTier
  daysFromToday: number // overdue는 음수, today는 0, upcoming은 양수
}

/**
 * 오늘 자정을 기준 시각으로 사용한다 (시간대 무시).
 * 컴포넌트가 렌더링 시점에 하루 안에서 새로고침해도 같은 날 안에서는
 * 안정적인 분류를 유지한다.
 */
export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 마일스톤 배열을 시급함 순으로 정렬하고 tier를 부착한다.
 * 순서: overdue(오래된 순) → today → upcoming(가까운 순).
 * 완료된 마일스톤은 제외한다. 원본 배열을 변경하지 않는다.
 */
export function sortByUrgency(
  milestones: Milestone[],
  now: Date = new Date()
): MilestoneWithUrgency[] {
  const todayStart = startOfToday(now)
  return milestones
    .filter((m) => !m.completed)
    .map((m) => {
      const milestoneDate = new Date(m.date + 'T00:00:00')
      const diffMs = milestoneDate.getTime() - todayStart.getTime()
      const daysFromToday = Math.round(diffMs / (1000 * 60 * 60 * 24))
      let tier: UrgencyTier
      if (daysFromToday < 0) tier = 'overdue'
      else if (daysFromToday === 0) tier = 'today'
      else tier = 'upcoming'
      return { milestone: m, tier, daysFromToday }
    })
    .sort((a, b) => {
      // tier 우선순위: overdue(0) < today(1) < upcoming(2)
      const tierOrder: Record<UrgencyTier, number> = {
        overdue: 0,
        today: 1,
        upcoming: 2,
      }
      if (tierOrder[a.tier] !== tierOrder[b.tier]) {
        return tierOrder[a.tier] - tierOrder[b.tier]
      }
      // 같은 tier 내: overdue는 오래된 순(과거 먼저), upcoming은 가까운 순
      return a.daysFromToday - b.daysFromToday
    })
}
