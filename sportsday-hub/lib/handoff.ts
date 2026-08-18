import { startOfToday } from '@/lib/milestones-urgency'
import { TEAM_IDS, type HandoffItem, type RecentFileItem, type TeamId } from '@/lib/types/models'

// 인계 시급함 — 오늘 자정 기준(스펙 §5). 임박 = 오늘~3일 이내.
export type HandoffUrgency = 'overdue' | 'due_soon' | 'scheduled' | 'no_due'

export function handoffUrgency(
  dueDate: string | null,
  completed: boolean,
  now: Date = new Date()
): HandoffUrgency {
  if (completed) return 'scheduled' // 완료는 기한 티어 무의미 — 정렬은 completed 플래그가 우선 관리
  if (!dueDate) return 'no_due'
  const todayStart = startOfToday(now)
  const due = new Date(dueDate + 'T00:00:00')
  const days = Math.round((due.getTime() - todayStart.getTime()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days <= 3) return 'due_soon'
  return 'scheduled'
}

const TIER_ORDER: Record<HandoffUrgency, number> = {
  overdue: 0,
  due_soon: 1,
  scheduled: 2,
  no_due: 3,
}

// 미완료 우선(urgency순, 티어 내 due 오름차순) → 완료는 뒤로(updated_at 내림차순). 원본 불변.
export function sortHandoffs(items: HandoffItem[], now: Date = new Date()): HandoffItem[] {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.completed) {
      return (b.updated_at ?? b.created_at ?? '').localeCompare(
        a.updated_at ?? a.created_at ?? ''
      )
    }
    const ta = TIER_ORDER[handoffUrgency(a.due_date, false, now)]
    const tb = TIER_ORDER[handoffUrgency(b.due_date, false, now)]
    if (ta !== tb) return ta - tb
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1 // 기한 있는 것이 기한 없는 것보다 앞
    if (b.due_date) return 1
    return 0
  })
}

export function handoffDirectionLabel(h: HandoffItem): string {
  const to = h.to_team ? h.to_team.name : (h.to_external ?? '알 수 없음')
  return `${h.from_team.name} → ${to}`
}

// 등록 폼 검증 — 팀/외부 정확히 하나. null 반환 시 유효.
export function validateHandoffTarget(
  toTeamId: string | null,
  toExternal: string | null
): string | null {
  const ext = toExternal?.trim() ?? ''
  if (toTeamId && ext) return '받는 팀과 외부 조직 중 하나만 선택해주세요.'
  if (!toTeamId && !ext) return '받는 쪽을 선택하거나 외부 조직명을 입력해주세요.'
  return null
}

// ?to= 파라미터 — 팀 id | 'external' | null(전체)
export function parseHandoffToFilter(
  param: string | null | undefined
): TeamId | 'external' | null {
  if (!param) return null
  if (param === 'external') return 'external'
  return (TEAM_IDS as readonly string[]).includes(param) ? (param as TeamId) : null
}

// getRecentDriveFiles(modified_time desc) 결과에서 팀별 최신 파일 맵.
// 입력이 desc 정렬임이 전제 — 첫 등장이 그 팀의 최신이다.
export function latestFileByTeamMap(
  files: RecentFileItem[]
): Map<string, RecentFileItem> {
  const map = new Map<string, RecentFileItem>()
  for (const f of files) {
    if (!map.has(f.team.id)) map.set(f.team.id, f)
  }
  return map
}
