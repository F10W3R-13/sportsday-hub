import { createClient } from '@/lib/supabase/server'
import type { Milestone, TeamId } from '@/lib/types/models'

export async function getMilestones(): Promise<Milestone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .is('deleted_at', null)
    .order('date', { nullsFirst: false })
    .order('sort_order')
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
    .order('date', { nullsFirst: false })
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getMilestoneById(id: string): Promise<Milestone | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}
