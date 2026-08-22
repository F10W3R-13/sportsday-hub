import { sortByUrgency, startOfToday } from '@/lib/milestones-urgency'
import type { Handoff, Milestone, Team } from '@/lib/types/models'

/**
 * 카카오톡 알림 다이제스트 — 작업(마일스톤 통합 엔터티)·인계 중 지연/D-Day/horizon일 내 항목을 묶는다.
 * 대시보드 긴급 위젯과 같은 긴급 척도(sortByUrgency)를 재사용.
 *
 * - compact: 카카오 메모('나에게 보내기') 200자 제한용 요약.
 * - detailed: 단체방 자동 전송용. 마감일(요일) 그룹핑 + D-7 예고 + 상시 과제 카운트.
 *
 * 임박 항목이 없어도 null을 반환하지 않고 "오늘 마감 없음 + 다음 마감" 안내를 반환한다
 * (매일 일정한 발송으로 봇 생존 확인 겸용).
 */

export interface KakaoDigest {
  text: string
  total: number // 지연·임박(horizon 내) 항목 수
  urgent: boolean // total > 0
}

export interface KakaoDigestOptions {
  now?: Date
  horizonDays?: number // 오늘로부터 몇 일까지 임박으로 볼지 (기본 3)
  previewDays?: number // 예고 줄에 보여줄 미래 범위 (기본 7)
  maxItems?: number // 메시지에 실을 최대 항목 수 (기본 6)
  siteUrl?: string
  textLimit?: number // 메시지 최대 길이 (기본 200 = 카카오 메모 템플릿 제한)
  style?: 'compact' | 'detailed' // 기본 compact
}

const DEFAULT_SITE_URL = 'https://sportsday-hub.vercel.app'
const KAKAO_TEXT_LIMIT = 200
const DOW = ['일', '월', '화', '수', '목', '금', '토']

interface UrgentEntry {
  days: number // 음수=지연, 0=오늘, 양수=남은 일수
  kind: 'milestone' | 'handoff'
  title: string
  team?: string
  dueDate: string // YYYY-MM-DD (그룹 헤더·예고 표기용)
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…'
}

function daysFrom(dueDate: string, todayStart: Date): number {
  const due = new Date(dueDate + 'T00:00:00')
  return Math.round((due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
}

/** 한국 표준시 기준 날짜 라벨 (예: 8/23(일)). now는 서버 시각(어떤 TZ이든). */
function kstDateLabel(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${DOW[kst.getUTCDay()]})`
}

/** 날짜 문자열 자체의 요일 (KST 해당일 요일과 동일). */
function dowOf(dateStr: string): string {
  return DOW[new Date(dateStr + 'T00:00:00Z').getUTCDay()]
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}(${dowOf(dateStr)})`
}

function teamLabel(entry: UrgentEntry): string {
  if (entry.kind === 'handoff') return entry.team ? ` → ${trim(entry.team, 10)}` : ''
  return entry.team ? ` — ${trim(entry.team, 10)}` : ''
}

/** 마감일 그룹 순서대로 헤더·항목 라인을 만든다. include는 본문에 실을 항목 수 상한. */
function renderGroups(entries: UrgentEntry[], include: number, style: 'compact' | 'detailed'): string[] {
  const lines: string[] = []
  let used = 0
  let i = 0
  while (i < entries.length && used < include) {
    const group: UrgentEntry[] = [entries[i]]
    while (i + 1 < entries.length && entries[i + 1].days === group[0].days) {
      group.push(entries[++i])
    }
    i++
    const shown = group.slice(0, Math.max(0, include - used))
    const days = group[0].days
    if (style === 'detailed') {
      const head =
        days < 0 ? `기한 지연 ${group.length}건` : days === 0 ? `오늘 ${shortDate(group[0].dueDate)} 마감 ${group.length}건` : `${shortDate(group[0].dueDate)} 마감 ${group.length}건`
      lines.push(head)
      shown.forEach((e) => lines.push(`· ${e.title}${days < 0 ? ` (D+${-days})` : ''}${teamLabel(e)}`))
    } else {
      const head =
        days < 0 ? `지연 ${group.length}건` : days === 0 ? `오늘 ${shortDate(group[0].dueDate)} ${group.length}건` : `${shortDate(group[0].dueDate)} ${group.length}건`
      lines.push(head)
      shown.forEach((e) => lines.push(`· ${trim(e.title, days < 0 ? 12 : 14)}${days < 0 ? '(D+' + -days + ')' : ''}${e.team ? '(' + trim(e.team, 4) + ')' : ''}`))
    }
    used += shown.length
    if (shown.length < group.length) break // 그룹이 잘리면 이후 그룹도 전부 '외 N건'으로
  }
  const omitted = entries.length - used
  if (omitted > 0) lines.push(`…외 ${omitted}건`)
  return lines
}

/**
 * 임박 항목이 하나도 없어도 안내 텍스트를 담은 다이제스트를 반환한다.
 */
export function buildKakaoDigest(
  input: { tasks: Milestone[]; handoffs: Handoff[]; teams: Team[] },
  options: KakaoDigestOptions = {}
): KakaoDigest {
  const {
    now = new Date(),
    horizonDays = 3,
    previewDays = 7,
    maxItems = 6,
    siteUrl = DEFAULT_SITE_URL,
    textLimit = KAKAO_TEXT_LIMIT,
    style = 'compact',
  } = options
  const todayStart = startOfToday(now)
  const teamName = new Map<string, string>(input.teams.map((t) => [t.id, t.name]))

  const entries: UrgentEntry[] = []
  const upcoming: UrgentEntry[] = [] // D-4 ~ D-previewDays (예고 줄용)
  let nextDue: UrgentEntry | null = null // 가장 가까운 미래 마감 (안내용)
  let undatedCount = 0

  // 작업: sortByUrgency 재사용 (미완료 필터·분류·정렬 포함).
  for (const { milestone, daysFromToday } of sortByUrgency(input.tasks, now)) {
    if (milestone.date === null) {
      undatedCount++
      continue
    }
    const entry: UrgentEntry = {
      days: daysFromToday === Number.MAX_SAFE_INTEGER ? previewDays + 1 : daysFromToday,
      kind: 'milestone',
      title: milestone.title,
      team: milestone.team_id ? teamName.get(milestone.team_id) : undefined,
      dueDate: milestone.date,
    }
    if (daysFromToday <= horizonDays) entries.push(entry)
    else {
      if (!nextDue || entry.days < nextDue.days) nextDue = entry
      if (daysFromToday <= previewDays) upcoming.push(entry)
    }
  }

  // 인계: due_date 기준 동일 산식
  for (const h of input.handoffs) {
    if (h.completed || !h.due_date) continue
    const days = daysFrom(h.due_date, todayStart)
    const entry: UrgentEntry = {
      days,
      kind: 'handoff',
      title: h.title,
      team: h.to_external ?? (h.to_team_id ? teamName.get(h.to_team_id) : undefined),
      dueDate: h.due_date,
    }
    if (days <= horizonDays) entries.push(entry)
    else {
      if (!nextDue || days < nextDue.days) nextDue = entry
      if (days <= previewDays) upcoming.push(entry)
    }
  }

  entries.sort((a, b) => a.days - b.days)
  upcoming.sort((a, b) => a.days - b.days)

  const date = kstDateLabel(now)
  const isDetailed = style === 'detailed'
  const nextDueText = nextDue ? `${shortDate(nextDue.dueDate)} ${trim(nextDue.title, isDetailed ? 20 : 12)}` : null

  const head = isDetailed ? `[스포츠데이 오늘의 할 일 ${date}]` : `[스포츠데이 임박 ${date}]`
  const foot = isDetailed ? `완료체크 & 세부사항 확인 ▸ ${siteUrl}` : siteUrl

  // 임박 없음: 안내 한 줄 발송 (매일 일정 도착 = 봇 생존 확인)
  if (entries.length === 0) {
    const lines = [head, nextDueText ? `오늘 마감 없음 — 다음: ${nextDueText}` : '오늘 마감 없음']
    if (isDetailed && undatedCount > 0) lines.push(`상시 과제 ${undatedCount}건 진행 중`)
    lines.push(foot)
    return { text: lines.join('\n'), total: 0, urgent: false }
  }

  // 본문: 그룹 렌더링 → (detailed) 예고·상시 줄 → foot. textLimit 안에 들 때까지 항목 수를 줄인다.
  const buildText = (include: number): string => {
    const lines = [head, ...renderGroups(entries, include, style)]
    if (upcoming.length > 0) {
      lines.push(isDetailed ? `다가오는 일정 D-${previewDays} 내 ${upcoming.length}건 · 다음: ${nextDueText}` : `외 D-${previewDays} 내 ${upcoming.length}건·다음 ${nextDueText}`)
    }
    if (isDetailed && undatedCount > 0) lines.push(`상시 과제 ${undatedCount}건 진행 중`)
    lines.push(foot)
    return lines.join('\n')
  }

  let include = Math.min(maxItems, entries.length)
  let text = buildText(include)
  while (text.length > textLimit && include > 1) {
    include--
    text = buildText(include)
  }
  if (text.length > textLimit) {
    text = text.slice(0, textLimit - 1) + '…'
  }

  return { text, total: entries.length, urgent: true }
}
