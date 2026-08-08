import { randomUUID } from 'crypto'
import type {
  Decision,
  Milestone,
  ChecklistItem,
  Issue,
  TeamId,
} from '@/lib/types/models'

// 마크다운 강조 표시 제거 (**, *, __, _) — 텍스트는 유지
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/(?<!\w)__(.+?)__(?!\w)/g, '$1') // __bold__
    .replace(/\*([^*]+?)\*/g, '$1') // *italic*
    .replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '$1') // _italic_
    .trim()
}

// ===== 섹션 분리: ## 헤더 기준 =====
export interface MdSection {
  level: number // 1,2,3...
  title: string
  body: string // 헤더 라인을 제외한 본문
  raw: string // 헤더 포함 원본
}

export function splitSections(md: string): MdSection[] {
  const lines = md.split('\n')
  const sections: MdSection[] = []
  let current: MdSection | null = null
  let buffer: string[] = []

  const flush = () => {
    if (current) {
      current.body = buffer.join('\n').trim()
      current.raw = `## ${current.title}\n${current.body}`
      sections.push(current)
    }
  }

  for (const line of lines) {
    const m = line.match(/^(#{2,6})\s+(.+)$/)
    if (m) {
      flush()
      current = {
        level: m[1].length,
        title: m[2].trim(),
        body: '',
        raw: '',
      }
      buffer = []
    } else if (current) {
      buffer.push(line)
    }
  }
  flush()
  return sections
}

// 마크다운 표 행 파서 (간단 버전 — | 구분)
export function parseTable(body: string): string[][] {
  const rows: string[][] = []
  let inTable = false
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // separator 행 (|---|---|) 건너뜀
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      rows.push(cells)
      inTable = true
    } else if (inTable && trimmed === '') {
      inTable = false
    }
  }
  return rows
}

// 체크리스트 "- [ ]" / "- [x]" 파서
export interface ParsedCheck {
  checked: boolean
  text: string
}

export function parseChecklist(body: string): ParsedCheck[] {
  const checks: ParsedCheck[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/)
    if (m) {
      checks.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() })
    }
  }
  return checks
}

// ===== 결정 추적표 파서 (마스터 §3) =====
// 표 형식: | # | 결정 항목 | 옵션 | 현재 상태 | 결정일 | 비고 |
// 상태에서 🟢확정 / 🟡검토 / 🔴미정 / ⚪보류 를 status로 매핑

function mapDecisionStatus(raw: string): {
  status: Decision['status']
  value: string | null
} {
  if (raw.includes('확정')) {
    const m = raw.match(/확정:?\s*\*?\*?([^*|]+)/)
    return { status: 'confirmed', value: m ? m[1].trim() : raw }
  }
  if (raw.includes('방향') || raw.includes('논의')) {
    return { status: 'discussing', value: raw.replace(/🟡/g, '').trim() || null }
  }
  if (raw.includes('보류')) {
    return { status: 'deferred', value: raw.replace(/⚪/g, '').trim() || null }
  }
  if (raw.includes('미정')) {
    return { status: 'pending', value: null }
  }
  return { status: 'pending', value: raw || null }
}

export function parseDecisions(md: string): Decision[] {
  const sections = splitSections(md)
  const decSection = sections.find((s) =>
    s.title.includes('핵심 결정 추적표')
  )
  if (!decSection) return []

  const rows = parseTable(decSection.body)
  // 첫 행은 헤더
  const dataRows = rows.slice(1)
  return dataRows
    .filter((r) => r[0] && r[0].startsWith('D'))
    .map((r, i) => {
      const id = r[0]?.trim() ?? ''
      const title = stripMarkdown(r[1]?.trim() ?? '')
      const optionsRaw = stripMarkdown(r[2]?.trim() ?? '')
      const options = optionsRaw
        ? optionsRaw.split('/').map((o) => o.trim()).filter(Boolean)
        : []
      const statusRaw = r[3]?.trim() ?? ''
      const { status, value } = mapDecisionStatus(statusRaw)
      const decisionDateRaw = r[4]?.trim() ?? ''
      // "8/5" 같은 한국식 날짜 → ISO로 정규화, "-"는 null
      const decisionDate =
        decisionDateRaw && decisionDateRaw !== '-'
          ? parseKoreanDate(decisionDateRaw) ?? decisionDateRaw
          : null
      const notesRaw = r[5]?.trim() || null
      const notes = notesRaw ? stripMarkdown(notesRaw) : null
      return {
        id,
        title,
        options,
        status,
        current_value: value ? stripMarkdown(value) : value,
        decision_date: decisionDate,
        sort_order: i,
        notes,
      } satisfies Decision
    })
}

// ===== 마일스톤 파서 (마스터 §4) =====
// §4-1 회의 일정: "- [ ] 이름 (날짜)" 형식 → category='meeting'
// §4-2 산출물 일정: 표 | 날짜 | 산출물 | 담당 | 완료 | → category='deliverable'

const TEAM_KEYWORD: Record<string, TeamId> = {
  컨텐츠: 'content',
  콘텐츠: 'content',
  예산: 'budget',
  교환: 'exchange',
  타임라인: 'timeline',
  기획관리: 'management',
  기획: 'management',
  전체: 'management',
}

function mapTeam(raw: string): TeamId | null {
  for (const [keyword, id] of Object.entries(TEAM_KEYWORD)) {
    if (raw.includes(keyword)) return id
  }
  return null
}

// 한국식 날짜 (8/9, 8/13 등) → ISO (2026-MM-DD)
function parseKoreanDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})/)
  if (!m) return null
  const month = m[1].padStart(2, '0')
  const day = m[2].padStart(2, '0')
  return `2026-${month}-${day}`
}

export function parseMilestones(md: string): Milestone[] {
  const sections = splitSections(md)
  const milestones: Milestone[] = []
  let sortOrder = 0

  // 회의 일정 (§4-1) — 체크리스트 형식
  const meetingSection = sections.find((s) => s.title.includes('회의 일정'))
  if (meetingSection) {
      const checks = parseChecklist(meetingSection.body)
      for (const c of checks) {
        const dateStr = parseKoreanDate(c.text)
        if (dateStr) {
          // "방중회의 (8/7 진행 완료)" → 완료 여부
          const completed = c.checked || c.text.includes('완료')
          const title = stripMarkdown(
            c.text
              .replace(/\([^)]*\)/g, '')
              .replace(/\s*—\s*.*$/, '')
              .replace(/\s{2,}/g, ' ')
              .trim()
          )
        milestones.push({
          id: randomUUID(),
          date: dateStr,
          title,
          team_id: null,
          category: 'meeting',
          completed,
          depends_on: null,
          sort_order: sortOrder++,
        })
      }
    }
  }

  // 산출물 일정 (§4-2) — 표 형식
  const deliverableSection = sections.find((s) =>
    s.title.includes('산출물 일정')
  )
  if (deliverableSection) {
    const rows = parseTable(deliverableSection.body)
    for (const r of rows.slice(1)) {
      const dateStr = parseKoreanDate(r[0] ?? '')
      if (dateStr) {
        const title = stripMarkdown(r[1]?.trim() ?? '')
        const teamRaw = r[2]?.trim() ?? ''
        const completedRaw = r[3]?.trim() ?? ''
        milestones.push({
          id: randomUUID(),
          date: dateStr,
          title,
          team_id: mapTeam(teamRaw),
          // 'Sports Day'는 산출물명(=title, r[1])에 등장 → r[1] 기준으로 event 분류
          category: title.includes('Sports Day') ? 'event' : 'deliverable',
          completed: completedRaw === '[x]',
          depends_on: null,
          sort_order: sortOrder++,
        })
      }
    }
  }

  return milestones
}

// ===== 체크리스트 파서 (각 팀 §진행 체크리스트 / 피드백 체크리스트) =====

function mapPriority(text: string): ChecklistItem['priority'] {
  if (text.includes('🔴') || text.includes('HIGH')) return 'high'
  if (text.includes('🟡') || text.includes('MID')) return 'medium'
  if (text.includes('🟢') || text.includes('LOW')) return 'low'
  return null
}

function detectSection(sectionTitle: string): ChecklistItem['section'] {
  if (sectionTitle.includes('피드백')) return 'feedback'
  if (
    sectionTitle.includes('진행 체크리스트') ||
    sectionTitle.includes('체크리스트')
  )
    return 'progress'
  return 'prep'
}

export function parseTeamChecklists(
  md: string,
  teamId: TeamId
): ChecklistItem[] {
  const sections = splitSections(md)
  const items: ChecklistItem[] = []
  let sortOrder = 0

  for (const section of sections) {
    if (
      section.title.toLowerCase().includes('체크리스트') ||
      section.title.includes('피드백')
    ) {
      const sectionType = detectSection(section.title)
      const checks = parseChecklist(section.body)
      for (const c of checks) {
        const priority = mapPriority(c.text)
        // 출처 추출: "(...출처...)" 괄호 또는 "← ..." 화살표 주석.
        // "— ..." 대시 주석은 본문과 구분이 모호해 제외 (nullable이므로 비핵심).
        const parenSource = c.text.match(
          /\(([^)]*(?:출처|피드백)[^)]*)\)/i
        )
        const arrowSource = c.text.match(/←\s*(.+?)\s*$/)
        const source =
          (parenSource && parenSource[1].trim()) ||
          (arrowSource && arrowSource[1].trim()) ||
          null
        // 이모지·우선순위 단어·출처 주석 제거한 본문
        let cleaned = c.text
          .replace(/[🔴🟡🟢⚪]/g, '')
          .replace(/\([^)]*(?:출처|피드백)[^)]*\)/gi, '')
          .replace(/←.*$/, '')
          // 끝에 붙은 우선순위 단어 (HIGH/MID/LOW) 제거
          .replace(/\s+(HIGH|MID|LOW)\s*$/i, '')
        // " — ..." 출처 주석 제거: 단, 괄호 균형이 맞을 때만 (괄호 안 대시는 본문)
        const dashIdx = cleaned.lastIndexOf('—')
        if (dashIdx !== -1) {
          const before = cleaned.slice(0, dashIdx)
          const opens = (before.match(/\(/g) || []).length
          const closes = (before.match(/\)/g) || []).length
          if (opens === closes) {
            cleaned = before
          }
        }
        const content = stripMarkdown(
          cleaned.replace(/\s{2,}/g, ' ').trim()
        )
        if (content) {
          items.push({
            id: randomUUID(),
            team_id: teamId,
            section: sectionType,
            content,
            priority,
            completed: c.checked,
            source,
            sort_order: sortOrder++,
          })
        }
      }
    }
  }

  return items
}

// ===== 이슈 파서 (마스터 §8 / 각 팀 §이슈 로그) =====
export function parseIssues(md: string, teamId: TeamId | null): Issue[] {
  const sections = splitSections(md)
  const issueSection = sections.find((s) =>
    s.title.toLowerCase().includes('이슈 로그')
  )
  if (!issueSection) return []

  const rows = parseTable(issueSection.body)
  return rows
    .slice(1)
    .filter((r) => r[1]?.trim()) // 제목이 있는 행만
    .map((r) => {
      const statusRaw = r[3]?.trim().toLowerCase() ?? ''
      let status: Issue['status'] = 'open'
      if (statusRaw.includes('progress') || statusRaw.includes('진행'))
        status = 'in_progress'
      else if (statusRaw.includes('resolve') || statusRaw.includes('해결'))
        status = 'resolved'
      return {
        id: randomUUID(),
        team_id: teamId,
        date: parseKoreanDate(r[0] ?? '') ?? null,
        title: r[1]?.trim() ?? '',
        status,
        notes: r[4]?.trim() ?? null,
      }
    })
}

// ===== 지침 섹션 파서 (JSONB용 — 체크리스트/이슈/결정/마일스톤 섹션 제외) =====
const EXCLUDED_SECTION_PATTERNS = [
  '핵심 결정 추적표',
  '마일스톤',
  '이슈 로그',
  '체크리스트',
  '피드백',
  '진행 체크리스트',
  '지침 파일 갱신',
  // §4 마일스톤의 하위 섹션들 (회의 일정 / 산출물 일정 / 의존관계)
  '4-1',
  '4-2',
  '4-3',
  // §7 갱신 가이드의 하위 섹션들
  '갱신 규칙',
  '파일 구조',
  '갱신 예시',
]

export interface GuidelineSection {
  id: string
  title: string
  order: number
  content_md: string
}

export function parseGuidelineSections(md: string): GuidelineSection[] {
  const sections = splitSections(md)
  const result: GuidelineSection[] = []
  let order = 0
  for (const section of sections) {
    const isExcluded = EXCLUDED_SECTION_PATTERNS.some((p) =>
      section.title.toLowerCase().includes(p.toLowerCase())
    )
    if (isExcluded) continue
    // slug id 생성
    const id = section.title
      .replace(/[^\w\s가-힣]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 50)
    result.push({
      id: id || `section-${order}`,
      title: section.title,
      order: order++,
      content_md: section.raw,
    })
  }
  return result
}
