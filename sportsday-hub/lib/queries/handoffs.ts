import { createClient } from '@/lib/supabase/server'
import type { Handoff, HandoffItem, Milestone, Team, TeamId } from '@/lib/types/models'

// 팀 조회에서 사라진 team_id의 폴백 배지 — 1단계 drive-files와 동일 값
const FALLBACK_TEAM = { name: '알 수 없음', color: '#94a3b8' } as const

type HandoffJoinRow = Handoff & {
  from_team: Team | null
  to_team: Team | null
  item: Pick<Milestone, 'id' | 'title' | 'team_id'> | null
}

export async function getHandoffs(): Promise<HandoffItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('handoffs')
    .select(
      `*,
       from_team:teams!handoffs_from_team_id_fkey(*),
       to_team:teams!handoffs_to_team_id_fkey(*),
       item:milestones!handoffs_item_id_fkey(id, title, team_id)`
    )
    .is('deleted_at', null)
  if (error) throw error

  const rows = (data ?? []) as unknown as HandoffJoinRow[]

  // 임베드된 팀 행이 없거나(조인 불능) 소프트 삭제된 경우 폴백
  const teamMeta = (
    id: TeamId,
    team: Team | null
  ): HandoffItem['from_team'] => {
    if (team && !team.deleted_at) {
      return { id: team.id, name: team.name, color: team.color }
    }
    return { id, ...FALLBACK_TEAM }
  }

  // sort_order 오름차순 — 브리프 테스트 mock은 select(...).is(...) 체인까지만
  // 지원하므로 DB .order() 대신 클라이언트 정렬로 동일 순서 보장
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((h) => ({
      ...h,
      from_team: teamMeta(h.from_team_id, h.from_team),
      to_team: h.to_team_id ? teamMeta(h.to_team_id, h.to_team) : null,
      item_title: h.item?.title ?? null,
      item_team_id: (h.item?.team_id ?? null) as TeamId | null,
    }))
}
