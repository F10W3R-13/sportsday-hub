import { EVENT_DATE_ISO } from './event-config'

// 행사일의 원천: DB(app_config) → lib/config.ts 의 getEventConfig 가 읽고,
// 이 파일(event-config.ts)은 DB가 비었을 때의 기본값을 담는다.
// 아래 레거시 export 들은 무DB 환경(테스트·스크립트) 호환용이며
// 런타임 화면은 config props 로 전달된 값을 쓴다.
export { EVENT_DATE_ISO }

const KOREAN_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 사이드바 등 UI 표기용 — "2026. 9. 20 (일)". 하드코딩 금지, 항상 이 함수를 쓴다. */
export function eventDateLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${y}. ${m}. ${d} (${KOREAN_WEEKDAYS[date.getDay()]})`
}

/**
 * 행사일까지 남은 일수 (D-day 당일 0). 로컬 자정 기준으로 계산해
 * 타임존에 따른 하루 오차를 방지한다.
 */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  const event = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(
    0,
    Math.round((event.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  )
}

// ── 레거시 wrapper (기본값 기준) — 테스트·기존 import 호환용 ──
export const EVENT_DATE_LABEL: string = eventDateLabel(EVENT_DATE_ISO)

export function daysUntilEvent(now: Date = new Date()): number {
  return daysUntil(EVENT_DATE_ISO, now)
}
