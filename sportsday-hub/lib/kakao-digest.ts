import { sortByUrgency, startOfToday } from '@/lib/milestones-urgency'
import type { ChecklistItem, Handoff, Milestone, Team } from '@/lib/types/models'

/**
 * 카카오 임박 알림 다이제스트 — 마일스톤·인계·체크리스트 중 지연/D-Day/horizon일 내 항목을 묶는다.
 * 대시보드 긴급 위젯과 같은 긴급 척도(sortByUrgency)를 재사용.
 *
 * - compact: 카카오 메모('나에게 보내기') 200자 제한용. 제목·팀명을 짧게 자른 요약 나열식.
 * - detailed: 단체방 자동 전송용. 잘라내기 없이 전체 제목·팀명 + 설명형 라벨.
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
  textLimit?: number // 메시지 최대 길이 (기본 200 = 카카오 메모 템플릿 제한)
  style?: 'compact' | 'detailed' // 기본 compact
}

const DEFAULT_SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200
const DETAILED_TITLE_LIMIT = 80 // 이상 길이 방지용 안전망 (실제로는 거의 안 잘림)

interface UrgentEntry {
  days: number // 음수=지연, 0=오늘, 양수=남은 일수
  kind: 'milestone' | 'checklist' | 'handoff'
  title: string
  team?: string
}

function daysLabel(days: number): string {
  if (days < 0) return `D+${-days}`
  if (days === 0) return '오늘'
  return `D-${days}`
}

function daysLabelDetailed(days: number): string {
  if (days < 0) return `기한 지연 (D+${-days})`
  if (days === 0) return '오늘 마감'
  return `D-${days} 남음`
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…'
}

function daysFrom(dueDate: string, todayStart: Date): number {
  const due = new Date(dueDate + 'T00:00:00')
  return Math.round((due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
}

function renderCompactLine(entry: UrgentEntry): string {
  const label = `[${daysLabel(entry.days)}]`
  if (entry.kind === 'handoff') {
    return `${label} 인계: ${trim(entry.title, 12)}${entry.team ? ` → ${trim(entry.team, 6)}` : ''}`
  }
  const prefix = entry.kind === 'checklist' ? '☐ ' : ''
  return `${label} ${prefix}${trim(entry.title, 14)}${entry.team ? ` (${trim(entry.team, 6)})` : ''}`
}

function renderDetailedBlock(entry: UrgentEntry): string[] {
  const head = `■ [${daysLabelDetailed(entry.days)}] ${trim(entry.title, DETAILED_TITLE_LIMIT)}`
  const lines = [head]
  if (entry.kind === 'handoff' && entry.team) lines.push(`   인수: ${entry.team}`)
  else if (entry.team) lines.push(`   담당: ${entry.team}`)
  return lines
}

/**
 * 임박 항목이 하나도 없으면 null을 반환한다 (알림 없음 = 미발송).
 */
export function buildKakaoDigest(
  input: { milestones: Milestone[]; handoffs: Handoff[]; teams: Team[]; checklistItems?: ChecklistItem[] },
  options: KakaoDigestOptions = {}
): KakaoDigest | null {
  const {
    now = new Date(),
    horizonDays = 3,
    maxItems = 6,
    siteUrl = DEFAULT_SITE_URL,
    textLimit = KAKAO_TEXT_LIMIT,
    style = 'compact',
  } = options
  const todayStart = startOfToday(now)
  const teamName = new Map(input.teams.map((t) => [t.id, t.name]))

  const entries: UrgentEntry[] = []

  // 체크리스트: 미완료 항목 중 연결된 마일스톤이 horizon 내인 것만.
  // 마일스톤에 묶이지 않은 '상시' 항목은 날짜 판단 근거가 없어 제외.
  // 세부 할 일이 표시되는 마일스톤은 마일스톤 줄 자체를 생략한다 (중복 방지).
  const milestoneById = new Map(input.milestones.map((m) => [m.id, m]))
  const coveredMilestoneIds = new Set<string>()
  if (input.checklistItems?.length) {
    for (const item of input.checklistItems) {
      if (item.completed || !item.milestone_id) continue
      const milestone = milestoneById.get(item.milestone_id)
      if (!milestone || milestone.completed) continue
      const days = daysFrom(milestone.date, todayStart)
      if (days > horizonDays) continue
      coveredMilestoneIds.add(item.milestone_id)
      entries.push({
        days,
        kind: 'checklist',
        title: item.content,
        team: item.team_id ? teamName.get(item.team_id) : undefined,
      })
    }
  }

  // 마일스톤: sortByUrgency 재사용 (완료 제외·정렬 포함).
  for (const { milestone, daysFromToday } of sortByUrgency(input.milestones, now)) {
    if (daysFromToday > horizonDays) continue
    if (coveredMilestoneIds.has(milestone.id)) continue
    entries.push({
      days: daysFromToday,
      kind: 'milestone',
      title: milestone.title,
      team: milestone.team_id ? teamName.get(milestone.team_id) : undefined,
    })
  }

  // 인계: due_date 기준 동일 산식
  for (const h of input.handoffs) {
    if (h.completed || !h.due_date) continue
    const days = daysFrom(h.due_date, todayStart)
    if (days > horizonDays) continue
    entries.push({
      days,
      kind: 'handoff',
      title: h.title,
      team: h.to_external ?? (h.to_team_id ? teamName.get(h.to_team_id) : undefined),
    })
  }

  if (entries.length === 0) return null

  entries.sort((a, b) => a.days - b.days)

  const date = `${now.getMonth() + 1}/${now.getDate()}`
  const isDetailed = style === 'detailed'

  let head: string
  let bodyLines: (include: number) => string[]
  let foot: string
  if (isDetailed) {
    head = `[스포츠데이 오늘의 할 일 ${date}]`
    bodyLines = (include) => {
      const omitted = entries.length - include
      const lines = entries.slice(0, include).flatMap(renderDetailedBlock)
      if (omitted > 0) lines.push(`…외 ${omitted}건`)
      return lines
    }
    foot = `자세한 내용: ${siteUrl}`
  } else {
    head = `[스포츠데이 임박 ${date}]`
    bodyLines = (include) => {
      const omitted = entries.length - include
      const lines = entries.slice(0, include).map((e) => '·' + renderCompactLine(e))
      if (omitted > 0) lines.push(`…외 ${omitted}건`)
      return lines
    }
    foot = siteUrl
  }

  // textLimit 안에 들어가도록 항목 수를 줄여가며 맞춘다
  let include = Math.min(maxItems, entries.length)
  let text = ''
  for (;;) {
    text = [head, ...bodyLines(include), foot].join('\n')
    if (text.length <= textLimit || include <= 1) break
    include--
  }
  if (text.length > textLimit) {
    text = text.slice(0, textLimit - 1) + '…'
  }

  return { text, total: entries.length }
}
