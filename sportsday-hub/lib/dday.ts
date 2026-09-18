export const EVENT_DATE_ISO = '2026-09-20'

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 사이드바 등 UI 표기용 — "2026. 9. 20 (일)". 하드코딩 금지, 항상 이 라벨을 쓴다. */
export const EVENT_DATE_LABEL: string = (() => {
  const [y, m, d] = EVENT_DATE_ISO.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${y}. ${m}. ${d} (${KOREAN_WEEKDAYS[date.getDay()]})`
})()

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
