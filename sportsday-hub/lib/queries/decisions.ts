import { createClient } from '@/lib/supabase/server'
import type { Decision } from '@/lib/types/models'

export async function getDecisions(): Promise<Decision[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}
