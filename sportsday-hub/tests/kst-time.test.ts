import { describe, it, expect } from 'vitest'
import { dayDiff, kstTodayStr, startOfToday } from '@/lib/milestones-urgency'

/**
 * KST 시간대 회귀 테스트 — 서버(또는 CI)가 UTC여도 같은 결과여야 한다.
 * 과거 결함: startOfToday가 서버 TZ 자정을 써서 UTC 컨테이너에서 KST 09:00까지 날짜가 밀렸다.
 * 검증 방법: UTC 시각을 그대로 인자로 넣어도 KST 날짜 경계가 정확한지 단언한다.
 * (이 테스트 파일이 어떤 TZ에서 돌아도 인자가 절대 UTC 시각이므로 결과는 일정하다.)
 */

// KST 2026-09-11 00:30 (UTC 2026-09-10 15:30) — 구버전 startOfToday라면 9/10으로 판정했을 지점
const JUST_AFTER_KST_MIDNIGHT = new Date('2026-09-10T15:30:00Z')
// KST 2026-09-10 23:59 (UTC 14:59) — 구버전이라면 이미 9/11로 밀었을 지점
const JUST_BEFORE_KST_MIDNIGHT = new Date('2026-09-10T14:59:59Z')
// KST 2026-09-11 09:00 (UTC 00:00)
const KST_9AM = new Date('2026-09-10T15:00:00Z')

describe('kstTodayStr — UTC 시계에서도 KST 날짜', () => {
  it('KST 자정 직후는 같은 날', () => {
    expect(kstTodayStr(JUST_AFTER_KST_MIDNIGHT)).toBe('2026-09-11')
  })
  it('KST 자정 직전은 전날', () => {
    expect(kstTodayStr(JUST_BEFORE_KST_MIDNIGHT)).toBe('2026-09-10')
  })
  it('KST 09:00 경계 (UTC 00:00)', () => {
    expect(kstTodayStr(KST_9AM)).toBe('2026-09-11')
  })
})

describe('startOfToday — KST 자정 인스턴스', () => {
  it('KST 자정 직후 호출 시 그 날의 KST 자정을 반환', () => {
    const expected = Date.parse('2026-09-11T00:00:00+09:00')
    expect(startOfToday(JUST_AFTER_KST_MIDNIGHT).getTime()).toBe(expected)
  })
  it('KST 자정 직전 호출 시 전날의 KST 자정을 반환', () => {
    const expected = Date.parse('2026-09-10T00:00:00+09:00')
    expect(startOfToday(JUST_BEFORE_KST_MIDNIGHT).getTime()).toBe(expected)
  })
})

describe('dayDiff — KST 오늘 기준 일수 차', () => {
  it('KST 9/11 00:30에 due 9/11은 오늘(0)', () => {
    expect(dayDiff('2026-09-11', JUST_AFTER_KST_MIDNIGHT)).toBe(0)
  })
  it('같은 순간 UTC 날짜로 어긋나던 due 9/10은 지연(-1)', () => {
    // 구버전(서버 TZ 자정 기준)이라면 9/10 15:30 UTC = 서버 자정 기준 9/10으로 계산돼 0이 나왔을 것
    expect(dayDiff('2026-09-10', JUST_AFTER_KST_MIDNIGHT)).toBe(-1)
  })
  it('미래는 양수', () => {
    expect(dayDiff('2026-09-12', JUST_AFTER_KST_MIDNIGHT)).toBe(1)
    expect(dayDiff('2026-09-14', KST_9AM)).toBe(3)
  })
  it('KST 자정을 넘으면 어제 due가 -1로 바뀐다', () => {
    expect(dayDiff('2026-09-10', JUST_BEFORE_KST_MIDNIGHT)).toBe(0)
    expect(dayDiff('2026-09-10', JUST_AFTER_KST_MIDNIGHT)).toBe(-1)
  })
})
