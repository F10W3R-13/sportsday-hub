import { createClient } from '@/lib/supabase/server'
import type { Issue, TeamId } from '@/lib/types/models'

export async function getIssues(): Promise<Issue[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function getIssuesByTeam(teamId: TeamId): Promise<Issue[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}
