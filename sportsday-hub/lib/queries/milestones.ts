import { createClient } from '@/lib/supabase/server'
import type { Milestone, TeamId } from '@/lib/types/models'

export async function getMilestones(): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .is('deleted_at', null)
    .order('date')
  if (error) throw error
  return data ?? []
}

export async function getMilestonesByTeam(
  teamId: TeamId
): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .order('date')
  if (error) throw error
  return data ?? []
}
