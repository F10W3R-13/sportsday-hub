import { createClient } from '@/lib/supabase/server'
import type { Team } from '@/lib/types/models'

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getTeam(id: string): Promise<Team | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
