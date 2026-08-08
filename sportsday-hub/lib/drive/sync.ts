import { createDriveClient } from './client'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import type { Database } from '@/lib/types/database'
import { TEAM_IDS, type TeamId } from '@/lib/types/models'

// drive 클라이언트 타입
type DriveClient = ReturnType<typeof google.drive>

// service_role 클라이언트 (RLS 우회, 서버 전용)
// route handler에서 재사용하기 위해 export
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  iconLink?: string
  modifiedTime?: string
  lastModifyingUser?: { displayName?: string }
  webViewLink?: string
}

// 단일 팀 폴더 동기화
async function syncTeamFolder(
  drive: DriveClient,
  teamId: TeamId,
  folderId: string
): Promise<number> {
  const supabase = createServiceClient()

  // 폴더 내 파일 목록 조회
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,iconLink,modifiedTime,lastModifyingUser/displayName,webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  })

  const files = (res.data.files ?? []) as DriveFileMeta[]
  const fileIds = files.map((f) => f.id)

  // 삭제된 파일 제거 (구글에 없는 파일)
  if (fileIds.length > 0) {
    await supabase
      .from('drive_files')
      .delete()
      .eq('team_id', teamId)
      .not('file_id', 'in', `(${fileIds.map((id) => `'${id}'`).join(',')})`)
  } else {
    // 폴더가 비었으면 전체 삭제
    await supabase.from('drive_files').delete().eq('team_id', teamId)
  }

  // 파일 upsert
  const now = new Date().toISOString()
  for (const file of files) {
    await supabase.from('drive_files').upsert(
      {
        team_id: teamId,
        file_id: file.id,
        name: file.name,
        mime_type: file.mimeType ?? null,
        icon_link: file.iconLink ?? null,
        modified_time: file.modifiedTime ?? null,
        modified_by: file.lastModifyingUser?.displayName ?? null,
        web_view_link: file.webViewLink ?? null,
        last_synced: now,
      },
      { onConflict: 'file_id' }
    )
  }

  return files.length
}

// 전체 또는 단일 팀 동기화
export async function syncDriveFiles(
  teamId?: TeamId,
  force = false
): Promise<{ success: boolean; syncedTeams: number; totalFiles: number; error?: string }> {
  const supabase = createServiceClient()

  // 중복 방지: 1분 이내 동기화 스킵 (force가 아니면)
  if (!force) {
    const { data: recent } = await supabase
      .from('drive_files')
      .select('last_synced')
      .order('last_synced', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent?.last_synced) {
      const elapsed = Date.now() - new Date(recent.last_synced).getTime()
      if (elapsed < 60_000) {
        return { success: true, syncedTeams: 0, totalFiles: 0 }
      }
    }
  }

  // 드라이브 클라이언트 생성
  const client = await createDriveClient()
  if (!client) {
    return { success: false, syncedTeams: 0, totalFiles: 0, error: 'not_connected' }
  }

  // 동기화할 팀 목록
  let teamsQuery = supabase.from('teams').select('id, drive_folder_id').not('drive_folder_id', 'is', null)
  if (teamId) {
    teamsQuery = teamsQuery.eq('id', teamId)
  }
  const { data: teams } = await teamsQuery

  if (!teams || teams.length === 0) {
    return { success: true, syncedTeams: 0, totalFiles: 0 }
  }

  let totalFiles = 0
  let syncedTeams = 0

  for (const team of teams) {
    try {
      const count = await syncTeamFolder(client.drive, team.id as TeamId, team.drive_folder_id!)
      totalFiles += count
      syncedTeams++
    } catch (err) {
      console.error(`Failed to sync team ${team.id}:`, err)
    }
  }

  return { success: true, syncedTeams, totalFiles }
}

// 연결 상태 확인
export async function getDriveConnectionStatus(): Promise<{
  connected: boolean
  email: string | null
}> {
  const client = await createDriveClient()
  if (!client) return { connected: false, email: null }
  return { connected: true, email: client.email }
}

// 팀별 폴더명 키워드 (자동 매핑용)
export const TEAM_FOLDER_KEYWORDS: Record<TeamId, string[]> = {
  management: ['기획', '관리', '총괄'],
  content: ['컨텐츠', '콘텐츠', '게임'],
  budget: ['예산'],
  exchange: ['교환'],
  timeline: ['타임라인', '인원', '버스'],
}

// 상위 폴더 내 하위 폴더를 탐색하여 팀별로 자동 매핑
export async function discoverTeamFolders(
  parentFolderId: string
): Promise<Record<string, string | null>> {
  const client = await createDriveClient()
  if (!client) throw new Error('Drive not connected')

  // 상위 폴더의 모든 하위 폴더 조회
  const res = await client.drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
  })
  const subfolders = (res.data.files ?? []) as { id: string; name: string }[]

  // 각 팀을 하위 폴더에 매칭 (키워드 포함 여부로 판별)
  const mapping: Record<string, string | null> = {}
  for (const teamId of TEAM_IDS) {
    const keywords = TEAM_FOLDER_KEYWORDS[teamId]
    const match = subfolders.find((f) =>
      keywords.some((kw) => f.name.toLowerCase().includes(kw.toLowerCase()))
    )
    mapping[teamId] = match?.id ?? null
  }
  return mapping
}
