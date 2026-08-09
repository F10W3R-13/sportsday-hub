import { createClient } from '@/lib/supabase/server'
import type { TeamId } from '@/lib/types/models'

export async function getChecklistItems() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .is('deleted_at', null)
    .order('milestone_id', { nullsFirst: false })
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getChecklistByTeam(teamId: TeamId) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .order('milestone_id', { nullsFirst: false })
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getChecklistByMilestone(milestoneId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('milestone_id', milestoneId)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getChecklistUnassigned() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .is('milestone_id', null)
    .is('deleted_at', null)
    .order('team_id')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
