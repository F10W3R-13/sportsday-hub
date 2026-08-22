import { describe, it, expect } from 'vitest'
import { kstTodayDate, kstClockLabel, buildBotAlert, isBotEnded } from '@/lib/kakao-bot'

const NOW = new Date('2026-08-23T09:30:00Z') // KST 8/23(일) 18:30

describe('kakao-bot 헬퍼', () => {
  it('KST 오늘 날짜', () => {
    expect(kstTodayDate(NOW)).toBe('2026-08-23')
  })
  it('KST 시각 라벨', () => {
    expect(kstClockLabel(NOW)).toContain('8/23(일)')
    expect(kstClockLabel(NOW)).toContain('18:30')
  })
  it('봇 종료 시점: 9/20 18:00 KST 경계', () => {
    expect(isBotEnded(new Date('2026-09-20T08:59:59Z'))).toBe(false) // KST 17:59:59
    expect(isBotEnded(new Date('2026-09-20T09:00:00Z'))).toBe(true) // KST 18:00:00
    expect(isBotEnded(new Date('2026-10-01T00:00:00Z'))).toBe(true)
  })
  it('fail 경보: 사유 한 줄 + 링크, 200자 이내', () => {
    const text = buildBotAlert('fail', '카카오톡 창을 찾을 수 없습니다', NOW)
    expect(text).toContain('단체방 자동 발송 실패')
    expect(text).toContain('사유: 카카오톡 창을 찾을 수 없습니다')
    expect(text).toContain('sportsday-hub.vercel.app')
    expect(text.length).toBeLessThanOrEqual(200)
  })
  it('fail 경보: 300자 사유는 80자로 클램프되고 URL은 잘리지 않음', () => {
    const longDetail = '에'.repeat(300)
    const text = buildBotAlert('fail', longDetail, NOW)
    expect(text).toContain('sportsday-hub.vercel.app')
    expect(text.length).toBeLessThanOrEqual(200)
    expect(text).toContain('사유:')
    expect(text).toContain('…')
  })
  it('watchdog 경보: 미실행 안내 + 링크', () => {
    const text = buildBotAlert('watchdog', null, NOW)
    expect(text).toContain('실행되지 않았습니다')
    expect(text).toContain('PC 전원·로그인·카카오톡 상태')
    expect(text).toContain('sportsday-hub.vercel.app')
  })
})
