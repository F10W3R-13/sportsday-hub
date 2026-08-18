import { createClient } from '@/lib/supabase/server'
import type { DriveFile, RecentFileItem, Team, TeamId } from '@/lib/types/models'

// 팀 조회에서 사라진 team_id(소프트삭제 등)의 폴백 배지 (스펙 §7)
const FALLBACK_TEAM = { name: '알 수 없음', color: '#94a3b8', icon: 'FileQuestion' } as const

export async function getDriveFilesByTeam(teamId: TeamId): Promise<DriveFile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drive_files')
    .select('*')
    .eq('team_id', teamId)
    .order('modified_time', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function getDriveFileCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('drive_files')
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}

// 전체 팀 최근 파일 — modified_time desc. 팀 메타는 앱 레이어에서 병합 (팀 5개라 저렴)
export async function getRecentDriveFiles(limit = 50): Promise<RecentFileItem[]> {
  const supabase = await createClient()
  const [{ data: files, error }, { data: teams }] = await Promise.all([
    supabase
      .from('drive_files')
      .select('*')
      .order('modified_time', { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase.from('teams').select('*').is('deleted_at', null),
  ])
  if (error) throw error

  const teamMap = new Map<string, Team>((teams ?? []).map((t) => [t.id, t]))
  return (files ?? []).map((file) => {
    const team = teamMap.get(file.team_id)
    return {
      ...file,
      team: team
        ? { id: team.id, name: team.name, color: team.color, icon: team.icon }
        : { id: file.team_id, ...FALLBACK_TEAM },
    }
  })
}

// 마지막 동기화 시각 — 위젯·페이지의 신선도 표시용
export async function getLastSyncedAt(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('drive_files')
    .select('last_synced')
    .order('last_synced', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return data?.last_synced ?? null
}
