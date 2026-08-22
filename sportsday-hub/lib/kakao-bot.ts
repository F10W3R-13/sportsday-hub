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

const SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200

/**
 * 봇 이상 경보 텍스트(카카오 메모 200자 제한 준수).
 * 가능하면 수동 폴백용 다이제스트 전문을 포함하고, 공간이 없으면 링크 안내로 축약한다.
 */
export function buildBotAlert(
  kind: 'fail' | 'watchdog',
  detail: string | null,
  digestText: string | null,
  now: Date = new Date()
): string {
  const when = kstClockLabel(now)
  const head =
    kind === 'fail'
      ? `[봇 알림] 단체방 자동 발송 실패 (${when})`
      : `[봇 알림] 18:00 단체방 발송이 실행되지 않았습니다 (${when}) — PC 전원·로그인·카카오톡 상태 확인`
  const cause = detail ? `\n사유: ${detail}` : ''
  const withDigest = `${head}${cause}\n아래 복사해 단체방에 붙여넣어주세요:\n\n${digestText ?? ''}`
  if (withDigest.length <= KAKAO_TEXT_LIMIT && digestText) return withDigest
  return `${head}${cause}\n오늘의 할 일: ${SITE_URL}`.slice(0, KAKAO_TEXT_LIMIT)
}
