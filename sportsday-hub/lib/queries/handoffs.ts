import { createClient } from '@/lib/supabase/server'
import type { ChecklistItem, HandoffItem, Team, TeamId } from '@/lib/types/models'

// 팀 조회에서 사라진 team_id의 폴백 배지 — 1단계 drive-files와 동일 값
const FALLBACK_TEAM = { name: '알 수 없음', color: '#94a3b8' } as const

export async function getHandoffs(): Promise<HandoffItem[]> {
  const supabase = await createClient()
  const [{ data: handoffs, error }, { data: teams }, { data: checklist }] = await Promise.all([
    supabase.from('handoffs').select('*').is('deleted_at', null),
    supabase.from('teams').select('*').is('deleted_at', null),
    supabase
      .from('checklist_items')
      .select('id, team_id, content')
      .is('deleted_at', null),
  ])
  if (error) throw error

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]))
  const checklistMap = new Map<string, ChecklistItem>(
    ((checklist ?? []) as ChecklistItem[]).map((c) => [c.id, c])
  )
  const teamMeta = (id: TeamId) => {
    const team = teamMap.get(id)
    return team
      ? { id: team.id, name: team.name, color: team.color }
      : { id, ...FALLBACK_TEAM }
  }

  // sort_order 오름차순 — 브리프 테스트 mock은 select(...).is(...) 체인까지만
  // 지원하므로 DB .order() 대신 클라이언트 정렬로 동일 순서 보장
  return [...(handoffs ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((h) => {
    const linked = h.checklist_item_id ? checklistMap.get(h.checklist_item_id) : undefined
    return {
      ...h,
      from_team: teamMeta(h.from_team_id),
      to_team: h.to_team_id ? teamMeta(h.to_team_id) : null,
      checklist_content: linked?.content ?? null,
      checklist_team_id: linked?.team_id ?? null,
    }
  })
}
