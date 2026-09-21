import { createClient } from '@/lib/supabase/server'
import type { TeamId, ActivityFeedItem } from '@/lib/types/models'

export async function getActivityFeed(
  teamId: TeamId,
  limit = 8
): Promise<ActivityFeedItem[]> {
  const supabase = await createClient()

  // 드라이브 파일 (최근 수정)
  const { data: files } = await supabase
    .from('drive_files')
    .select('*')
    .eq('team_id', teamId)
    .order('modified_time', { ascending: false, nullsFirst: false })
    .limit(limit)

  // 감사 로그 (해당 팀 관련)
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // 두 소스를 ActivityFeedItem으로 변환 + 시간순 병합
  const fileItems: ActivityFeedItem[] = (files ?? []).map((f) => ({
    id: `file-${f.file_id}`,
    type: 'file' as const,
    title: f.name,
    timestamp: f.modified_time ?? f.last_synced ?? new Date().toISOString(),
    actor: f.modified_by ?? '알 수 없음',
    link: f.web_view_link ?? undefined,
    mimeType: f.mime_type ?? undefined,
  }))

  const logItems: ActivityFeedItem[] = (logs ?? []).map((l) => ({
    id: `log-${l.id}`,
    type: l.table_name === 'decisions' ? 'decision' : l.table_name === 'issues' ? 'issue' : 'checklist',
    title: extractTitle(l),
    timestamp: l.created_at ?? new Date().toISOString(),
    actor: l.changed_by,
  }))

  const merged = [...fileItems, ...logItems]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)

  return merged
}

function extractTitle(log: {
  table_name: string
  new_value: unknown
  old_value: unknown
  action: string
}): string {
  const newValue = log.new_value as Record<string, unknown> | null
  if (newValue) {
    if (typeof newValue.content === 'string') return newValue.content.slice(0, 60)
    if (typeof newValue.title === 'string') return newValue.title.slice(0, 60)
    if (typeof newValue.current_value === 'string') return newValue.current_value.slice(0, 60)
  }
  return `${log.table_name} ${log.action}`
}
