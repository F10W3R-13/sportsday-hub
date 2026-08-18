import { describe, it, expect, vi, afterEach } from 'vitest'
import { timeAgo } from '@/lib/format/time-ago'

// 경계 검증용 기준 시각. 정오(UTC) 기준 같은 날짜는 모든 시간대에서 동일하다.
const NOW = '2026-08-18T12:00:00Z'

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers())

  it('59분 이하는 "N분 전"', () => {
    vi.setSystemTime(new Date(NOW))
    expect(timeAgo('2026-08-18T11:30:00Z')).toBe('30분 전')
  })

  it('23시간 이하는 "N시간 전"', () => {
    vi.setSystemTime(new Date(NOW))
    expect(timeAgo('2026-08-17T13:00:00Z')).toBe('23시간 전')
  })

  it('6일 이하는 "N일 전"', () => {
    vi.setSystemTime(new Date(NOW))
    expect(timeAgo('2026-08-15T12:00:00Z')).toBe('3일 전')
  })

  it('7일 이상은 "M월 d일"', () => {
    vi.setSystemTime(new Date(NOW))
    expect(timeAgo('2026-08-01T12:00:00Z')).toBe('8월 1일')
  })
})
