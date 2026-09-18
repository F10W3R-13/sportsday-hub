import { describe, it, expect } from 'vitest'
import { EVENT_DATE_ISO, EVENT_DATE_LABEL } from '@/lib/dday'

// 사이드바가 하드코딩 대신 이 라벨을 쓴다 — 원천(EVENT_DATE_ISO)과 어긋나면 깨진다.
describe('EVENT_DATE_LABEL', () => {
  it('행사일과 요일이 원천 날짜에서 정확히 유도된다', () => {
    expect(EVENT_DATE_LABEL).toBe('2026. 9. 20 (일)')
  })

  it('라벨이 원천 ISO 날짜와 일치한다', () => {
    const [y, m, d] = EVENT_DATE_ISO.split('-').map(Number)
    expect(EVENT_DATE_LABEL.startsWith(`${y}. ${m}. ${d} `)).toBe(true)
  })
})
