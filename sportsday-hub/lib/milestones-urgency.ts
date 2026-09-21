import type { Milestone } from '@/lib/types/models'

/**
 * 마일스톤 시급함 분류.
 * - overdue: 미완료 + 날짜가 오늘 자정 이전 (지연)
 * - today: 미완료 + 오늘 (자정 ~ 내일 자정)
 * - upcoming: 미완료 + 오늘 이후
 * - undated: 미완료 + date null (상시 항목, 맨 뒤 정렬)
 * - 완료 항목은 분류에서 제외
 */
export type UrgencyTier = 'overdue' | 'today' | 'upcoming' | 'undated'

export interface MilestoneWithUrgency {
  milestone: Milestone
  tier: UrgencyTier
  daysFromToday: number // overdue는 음수, today는 0, upcoming은 양수
}

/** KST UTC 오프셋 (밀리초) — 대한민국은 DST 없이 고정. */
export const KST_TIMEZONE_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 오늘 날짜 'YYYY-MM-DD' (서버 TZ 무관 — UTC 컨테이너에서도 동일). */
export function kstTodayStr(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * 오늘(KST) 자정 인스턴스. 서버 TZ와 무관하게 같은 KST 날이면 항상 같은 값.
 * 날짜 기반 판정 전용 — KST 자정~09:00 사이 호출 시 최대 +9h 미래 시각을 가리키므로
 * 저장하거나 현재 시각과 직접 비교하는 용도로는 쓰지 않는다.
 */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(Date.parse(`${kstTodayStr(now)}T00:00:00Z`) - KST_TIMEZONE_OFFSET_MS)
}

/**
 * dueDate('YYYY-MM-DD')와 오늘(KST)의 일수 차. 음수=지연, 0=오늘, 양수=남은 일수.
 * 날짜 문자열은 UTC 자정으로 파싱한다 — 서버 TZ에 따라 하루가 밀리는 과거 결함 제거.
 */
export function dayDiff(dueDate: string, now: Date = new Date()): number {
  return Math.floor(
    (Date.parse(`${dueDate}T00:00:00Z`) - startOfToday(now).getTime()) / 86_400_000
  )
}

/**
 * 마일스톤 배열을 시급함 순으로 정렬하고 tier를 부착한다.
 * 순서: overdue(오래된 순) → today → upcoming(가까운 순) → undated.
 * 완료된 마일스톤은 제외한다. 원본 배열을 변경하지 않는다.
 */
export function sortByUrgency(
  milestones: Milestone[],
  now: Date = new Date()
): MilestoneWithUrgency[] {
  // date가 null인(상시) 항목은 'undated' tier로 분류해 배열 맨 뒤로 보낸다
  const dated = milestones.filter((m): m is Milestone & { date: string } => m.date !== null)
  const undated = milestones.filter((m) => m.date === null)
  return [
    ...dated
      .filter((m) => !m.completed)
      .map((m) => {
        const daysFromToday = dayDiff(m.date, now)
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
          undated: 3,
        }
        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
          return tierOrder[a.tier] - tierOrder[b.tier]
        }
        // 같은 tier 내: overdue는 오래된 순(과거 먼저), upcoming은 가까운 순
        return a.daysFromToday - b.daysFromToday
      }),
    ...undated
      .filter((m) => !m.completed)
      .map((m) => ({
        milestone: m,
        tier: 'undated' as const,
        daysFromToday: Number.MAX_SAFE_INTEGER,
      })),
  ]
}
