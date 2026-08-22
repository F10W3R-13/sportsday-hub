const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** KST 오늘 날짜 'YYYY-MM-DD' (봇 보고·watchdog 조회의 run_date 기준). */
export function kstTodayDate(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** KST 시각 라벨 'M/D(요일) HH:mm' (경보 헤더용). */
export function kstClockLabel(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${DOW[kst.getUTCDay()]}) ${hh}:${mm}`
}

/** 행사 종료 후 봇 무동작 시점 (2026-09-20 18:00 KST) — 이후 알림·경보·watchdog 모두 중단. */
export const BOT_END_KST = new Date('2026-09-20T18:00:00+09:00')

/** now가 봇 종료 시점 이후인지 (KST 기준). */
export function isBotEnded(now: Date = new Date()): boolean {
  return now.getTime() >= BOT_END_KST.getTime()
}

const SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200
const DETAIL_CLAMP = 80

/**
 * 봇 이상 경보 텍스트(카카오 메모 200자 제한 준수).
 * 사유 한 줄 + 링크만 담는다 — 상세 내용은 웹앱 링크로 대체 (200자엔 폴백 텍스트가 안 담기는 게 실측 확인됨).
 * 사유는 80자로 클램프하고 URL이 잘리지 않도록 남는 공간에 배치한다.
 */
export function buildBotAlert(
  kind: 'fail' | 'watchdog',
  detail: string | null,
  now: Date = new Date()
): string {
  const when = kstClockLabel(now)
  const head =
    kind === 'fail'
      ? `[봇 알림] 단체방 자동 발송 실패 (${when})`
      : `[봇 알림] 18:00 단체방 발송이 실행되지 않았습니다 (${when}) — PC 전원·로그인·카카오톡 상태 확인`
  const tail = `\n오늘의 할 일: ${SITE_URL}`
  const budget = KAKAO_TEXT_LIMIT - head.length - tail.length
  let cause = ''
  if (detail) {
    const clamped =
      detail.length > DETAIL_CLAMP ? `${detail.slice(0, DETAIL_CLAMP)}…` : detail
    cause = `\n사유: ${clamped}`
    if (cause.length > budget) {
      const bodyBudget = budget - '\n사유: '.length - 1 // 1 = 말줄임 '…'
      cause =
        bodyBudget > 0 ? `\n사유: ${detail.slice(0, Math.min(bodyBudget, DETAIL_CLAMP))}…` : ''
    }
  }
  return `${head}${cause}${tail}`
}
