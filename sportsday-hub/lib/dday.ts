export const EVENT_DATE_ISO = '2026-09-19'

/**
 * 행사일까지 남은 일수 (D-day 당일 0). 로컬 자정 기준으로 계산해
 * 타임존에 따른 하루 오차를 방지한다.
 */
export function daysUntilEvent(now: Date = new Date()): number {
  const [y, m, d] = EVENT_DATE_ISO.split('-').map(Number)
  const event = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(
    0,
    Math.round((event.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  )
}
