'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/queries/keys'
import {
  AUDIT_ACTION_LABEL,
  type AuditLog,
} from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

// 클라이언트용 audit fetch — 서버 쿼리(getAuditForRecord)는 서버 Supabase
// 클라이언트를 사용하므로, 이 다이얼로그(클라이언트 컴포넌트)에서는
// 브라우저 클라이언트로 직접 쿼리한다.
async function fetchAuditForRecord(
  table: string,
  recordId: string
): Promise<AuditLog[]> {
  const client = createClient()
  const { data, error } = await client
    .from('audit_log')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as AuditLog[]
}

export function AuditLogDialog({
  open,
  onClose,
  table,
  recordId,
  title,
}: {
  open: boolean
  onClose: () => void
  table: string
  recordId: string
  title: string
}) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.auditForRecord(table, recordId),
    queryFn: () => fetchAuditForRecord(table, recordId),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>변경 이력 — {title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              불러오는 중...
            </p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              변경 기록이 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md border p-2 text-sm"
                >
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                    {AUDIT_ACTION_LABEL[log.action]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{log.changed_by}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.created_at
                        ? format(
                            parseISO(log.created_at),
                            'yyyy. M. d. a h:mm',
                            { locale: ko }
                          )
                        : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
