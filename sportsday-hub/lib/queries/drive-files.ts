import { createClient } from '@/lib/supabase/server'
import type { DriveFile, TeamId } from '@/lib/types/models'

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
