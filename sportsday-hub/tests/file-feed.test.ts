import { describe, it, expect } from 'vitest'
import {
  shouldSkipSync,
  isNewFile,
  parseTeamFilter,
  shouldRefreshAfterSync,
} from '@/lib/file-feed'

const NOW = new Date('2026-08-18T12:00:00Z').getTime()

describe('shouldSkipSync — 5분 신선도', () => {
  it('4분 전 동기화면 스킵', () => {
    expect(shouldSkipSync('2026-08-18T11:56:00Z', NOW)).toBe(true)
  })
  it('6분 전이면 실행', () => {
    expect(shouldSkipSync('2026-08-18T11:54:00Z', NOW)).toBe(false)
  })
  it('null/undefined면 실행 (첫 동기화)', () => {
    expect(shouldSkipSync(null, NOW)).toBe(false)
    expect(shouldSkipSync(undefined, NOW)).toBe(false)
  })
})

describe('isNewFile — 72시간 NEW 배지', () => {
  it('71시간 전 생성이면 true', () => {
    expect(isNewFile('2026-08-15T13:00:00Z', NOW)).toBe(true)
  })
  it('73시간 전 생성이면 false', () => {
    expect(isNewFile('2026-08-15T11:00:00Z', NOW)).toBe(false)
  })
  it('null/빈값이면 false', () => {
    expect(isNewFile(null, NOW)).toBe(false)
    expect(isNewFile(undefined, NOW)).toBe(false)
    expect(isNewFile('', NOW)).toBe(false)
  })
  it('파싱 불가능한 문자열이면 false', () => {
    expect(isNewFile('not-a-date', NOW)).toBe(false)
  })
})

describe('parseTeamFilter — ?team= 파라미터', () => {
  it('유효 팀 id면 그대로 반환', () => {
    expect(parseTeamFilter('content')).toBe('content')
    expect(parseTeamFilter('timeline')).toBe('timeline')
  })
  it('무효 값이면 null (전체 폴백)', () => {
    expect(parseTeamFilter('hacky')).toBeNull()
  })
  it('null/빈값이면 null (전체)', () => {
    expect(parseTeamFilter(null)).toBeNull()
    expect(parseTeamFilter('')).toBeNull()
  })
})

describe('shouldRefreshAfterSync — 트리거 화면 갱신 판정', () => {
  it('성공 + 스킵 아님 → 갱신', () => {
    expect(shouldRefreshAfterSync({ success: true, syncedTeams: 2, totalFiles: 7 })).toBe(true)
  })
  it('성공 + 신선도 스킵 → 갱신 안 함', () => {
    expect(
      shouldRefreshAfterSync({ success: true, syncedTeams: 0, totalFiles: 0, skipped: true })
    ).toBe(false)
  })
  it('실패 응답 → 갱신 안 함', () => {
    expect(shouldRefreshAfterSync({ success: false })).toBe(false)
  })
  it('null·비객체 → 갱신 안 함', () => {
    expect(shouldRefreshAfterSync(null)).toBe(false)
    expect(shouldRefreshAfterSync('x')).toBe(false)
  })
})
