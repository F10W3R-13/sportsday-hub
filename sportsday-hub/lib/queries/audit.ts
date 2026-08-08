import { createClient } from '@/lib/supabase/server'
import type { AuditLog } from '@/lib/types/models'

export async function getAuditLog(limit = 50): Promise<AuditLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getAuditForRecord(
  table: string,
  recordId: string
): Promise<AuditLog[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}
