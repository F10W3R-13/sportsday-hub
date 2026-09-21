import { describe, it, expect } from 'vitest'
import { EVENT_DATE_ISO, EVENT_DATE_LABEL } from '@/lib/dday'

// 사이드바가 하드코딩 대신 이 라벨을 쓴다 — 원천(lib/event-config.ts의
// EVENT_DATE_ISO)과 어긋나면 깨진다. 연도가 바뀌어도 테스트는 수정 불필요.
describe('EVENT_DATE_LABEL', () => {
  it('행사일과 요일이 원천 날짜에서 정확히 유도된다', () => {
    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
    const [y, m, d] = EVENT_DATE_ISO.split('-').map(Number)
    expect(EVENT_DATE_LABEL).toBe(`${y}. ${m}. ${d} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`)
  })

  it('라벨이 원천 ISO 날짜와 일치한다', () => {
    const [y, m, d] = EVENT_DATE_ISO.split('-').map(Number)
    expect(EVENT_DATE_LABEL.startsWith(`${y}. ${m}. ${d} `)).toBe(true)
  })
})
