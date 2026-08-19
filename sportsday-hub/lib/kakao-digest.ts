import { sortByUrgency, startOfToday } from '@/lib/milestones-urgency'
import type { Handoff, Milestone, Team } from '@/lib/types/models'

/**
 * 카카오 임박 알림 다이제스트 — 마일스톤·인계 중 지연/D-Day/horizon일 내 항목을
 * 카카오 텍스트 템플릿(최대 200자)에 맞춰 한 문장으로 묶는다.
 * 대시보드 긴급 위젯과 같은 긴급 척도(sortByUrgency)를 재사용.
 */

export interface KakaoDigest {
  text: string
  total: number // 잘린 항목 포함 전체 임박 건수
}

export interface KakaoDigestOptions {
  now?: Date
  horizonDays?: number // 오늘로부터 몇 일까지 임박으로 볼지 (기본 3)
  maxItems?: number // 메시지에 실을 최대 항목 수 (기본 6)
  siteUrl?: string
}

const DEFAULT_SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200

interface UrgentEntry {
  days: number // 음수=지연, 0=오늘, 양수=남은 일수
  label: string
}

function daysLabel(days: number): string {
  if (days < 0) return `D+${-days}`
  if (days === 0) return '오늘'
  return `D-${days}`
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…'
}

function daysFrom(dueDate: string, todayStart: Date): number {
  const due = new Date(dueDate + 'T00:00:00')
  return Math.round((due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * 임박 항목이 하나도 없으면 null을 반환한다 (알림 없음 = 미발송).
 */
export function buildKakaoDigest(
  input: { milestones: Milestone[]; handoffs: Handoff[]; teams: Team[] },
  options: KakaoDigestOptions = {}
): KakaoDigest | null {
  const {
    now = new Date(),
    horizonDays = 3,
    maxItems = 6,
    siteUrl = DEFAULT_SITE_URL,
  } = options
  const todayStart = startOfToday(now)
  const teamName = new Map(input.teams.map((t) => [t.id, t.name]))

  const entries: UrgentEntry[] = []

  // 마일스톤: sortByUrgency 재사용 (완료 제외·정렬 포함)
  for (const { milestone, daysFromToday } of sortByUrgency(input.milestones, now)) {
    if (daysFromToday > horizonDays) continue
    const team = milestone.team_id ? teamName.get(milestone.team_id) : undefined
    entries.push({
      days: daysFromToday,
      label: `[${daysLabel(daysFromToday)}] ${trim(milestone.title, 14)}${team ? ` (${trim(team, 6)})` : ''}`,
    })
  }

  // 인계: due_date 기준 동일 산식
  for (const h of input.handoffs) {
    if (h.completed || !h.due_date) continue
    const days = daysFrom(h.due_date, todayStart)
    if (days > horizonDays) continue
    const to = h.to_external ?? (h.to_team_id ? teamName.get(h.to_team_id) : undefined)
    entries.push({
      days,
      label: `[${daysLabel(days)}] 인계: ${trim(h.title, 12)}${to ? ` → ${trim(to, 6)}` : ''}`,
    })
  }

  if (entries.length === 0) return null

  entries.sort((a, b) => a.days - b.days)

  const date = `${now.getMonth() + 1}/${now.getDate()}`
  const head = `[스포츠데이 임박 ${date}]`

  // 200자 안에 들어가도록 항목 수를 줄여가며 맞춘다
  let include = Math.min(maxItems, entries.length)
  let text = ''
  for (;;) {
    const omitted = entries.length - include
    const lines = entries.slice(0, include).map((e) => '·' + e.label)
    if (omitted > 0) lines.push(`…외 ${omitted}건`)
    text = [head, ...lines, siteUrl].join('\n')
    if (text.length <= KAKAO_TEXT_LIMIT || include <= 1) break
    include--
  }
  if (text.length > KAKAO_TEXT_LIMIT) {
    text = text.slice(0, KAKAO_TEXT_LIMIT - 1) + '…'
  }

  return { text, total: entries.length }
}
