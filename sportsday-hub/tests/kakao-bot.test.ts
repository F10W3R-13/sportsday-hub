import { describe, it, expect } from 'vitest'
import { kstTodayDate, kstClockLabel, buildBotAlert } from '@/lib/kakao-bot'

const NOW = new Date('2026-08-23T09:30:00Z') // KST 8/23(일) 18:30

describe('kakao-bot 헬퍼', () => {
  it('KST 오늘 날짜', () => {
    expect(kstTodayDate(NOW)).toBe('2026-08-23')
  })
  it('KST 시각 라벨', () => {
    expect(kstClockLabel(NOW)).toContain('8/23(일)')
    expect(kstClockLabel(NOW)).toContain('18:30')
  })
  it('fail 경보: 짧은 다이제스트는 전문 포함, 200자 이내', () => {
    const text = buildBotAlert(
      'fail',
      '카카오톡 창을 찾을 수 없습니다',
      '[스포츠데이 오늘의 할 일 8/23(일)]\n8/25(화) 마감 4건',
      NOW
    )
    expect(text).toContain('단체방 자동 발송 실패')
    expect(text).toContain('카카오톡 창을 찾을 수 없습니다')
    expect(text).toContain('8/25(화) 마감 4건')
    expect(text.length).toBeLessThanOrEqual(200)
  })
  it('fail 경보: 다이제스트가 길면 사유+링크로 축약', () => {
    const longDigest = 'x'.repeat(300)
    const text = buildBotAlert('fail', '전송 오류', longDigest, NOW)
    expect(text).toContain('단체방 자동 발송 실패')
    expect(text).not.toContain('xxx')
    expect(text.length).toBeLessThanOrEqual(200)
    expect(text).toContain('sportsday-hub.vercel.app')
  })
  it('fail 경보: 300자 사유는 80자로 클램프되고 URL은 잘리지 않음', () => {
    const longDetail = '에'.repeat(300)
    const text = buildBotAlert('fail', longDetail, null, NOW)
    expect(text).toContain('sportsday-hub.vercel.app')
    expect(text.length).toBeLessThanOrEqual(200)
    expect(text).toContain('사유:')
    expect(text).toContain('…')
  })
  it('watchdog 경보: 미실행 안내 + 다이제스트 포함', () => {
    const text = buildBotAlert(
      'watchdog',
      null,
      '[스포츠데이 오늘의 할 일 8/23(일)]\n오늘 마감 없음',
      NOW
    )
    expect(text).toContain('실행되지 않았습니다')
    expect(text).toContain('PC 전원·로그인·카카오톡 상태')
    expect(text).toContain('오늘 마감 없음')
  })
  it('watchdog 경보: 다이제스트 null이면 링크 안내', () => {
    const text = buildBotAlert('watchdog', null, null, NOW)
    expect(text).toContain('실행되지 않았습니다')
    expect(text).toContain('sportsday-hub.vercel.app')
  })
})
