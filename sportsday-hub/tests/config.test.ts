import { describe, it, expect } from 'vitest'
import { mergeConfig, FALLBACK_CONFIG } from '@/lib/config'

// mergeConfig 순수 함수 검증 — DB(app_config) 값과 폴백(event-config.ts)의 병합 규칙.
// getEventConfig 자체는 요청 캐시+supabase 클라이언트를 감싸므로 여기선 병합만 검증한다.

describe('mergeConfig — DB 값 우선·폴백 안전망', () => {
  it('빈 행이면 전부 폴백 기본값', () => {
    const c = mergeConfig([])
    expect(c.hubTitle).toBe(FALLBACK_CONFIG.hub_title)
    expect(c.eventDateIso).toBe(FALLBACK_CONFIG.event_date_iso)
    expect(c.eventYear).toBe(FALLBACK_CONFIG.event_date_iso.slice(0, 4))
  })

  it('DB 값이 있으면 우선한다', () => {
    const c = mergeConfig([
      { key: 'hub_title', value: '올해 허브' },
      { key: 'event_name', value: '27-1 스포츠데이' },
      { key: 'event_date_iso', value: '2027-03-20' },
    ])
    expect(c.hubTitle).toBe('올해 허브')
    expect(c.eventName).toBe('27-1 스포츠데이')
    expect(c.eventDateIso).toBe('2027-03-20')
    // semester_label 은 DB에 없다 → 폴백
    expect(c.semesterLabel).toBe(FALLBACK_CONFIG.semester_label)
  })

  it('빈 문자열·공백 값은 무시하고 폴백', () => {
    const c = mergeConfig([
      { key: 'hub_title', value: '   ' },
      { key: 'event_date_iso', value: '' },
    ])
    expect(c.hubTitle).toBe(FALLBACK_CONFIG.hub_title)
    expect(c.eventDateIso).toBe(FALLBACK_CONFIG.event_date_iso)
  })

  it('날짜 형식이 어긋난 event_date_iso 는 폴백 (앱이 깨지지 않게)', () => {
    const c = mergeConfig([{ key: 'event_date_iso', value: '2027-3-20' }])
    expect(c.eventDateIso).toBe(FALLBACK_CONFIG.event_date_iso)
  })

  it('파생값 — 라벨·D-day·연도가 eventDateIso에서 정확히 계산된다', () => {
    const c = mergeConfig([{ key: 'event_date_iso', value: '2027-03-20' }])
    // 2027-03-20은 토요일
    expect(c.eventDateLabel).toBe('2027. 3. 20 (토)')
    expect(c.eventYear).toBe('2027')
    expect(Number.isInteger(c.daysUntil)).toBe(true)
    expect(c.daysUntil).toBeGreaterThanOrEqual(0)
  })

  it('모르는 키는 무시한다', () => {
    const c = mergeConfig([{ key: 'unknown_key', value: 'x' }])
    expect(c.hubTitle).toBe(FALLBACK_CONFIG.hub_title)
  })
})
