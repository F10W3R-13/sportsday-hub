import { createClient } from '@/lib/supabase/server'
import type { ChecklistItem, TeamId } from '@/lib/types/models'

export async function getChecklistItems(): Promise<ChecklistItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('team_id')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getChecklistByTeam(
  teamId: TeamId
): Promise<ChecklistItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('team_id', teamId)
    .order('section')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
