'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, ensureContext } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { RotateCcw, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queries/keys'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { ChecklistItem, Issue } from '@/lib/types/models'

type TrashEntryKind = 'checklist_items' | 'issues'

type TrashEntry = {
  id: string
  kind: TrashEntryKind
  label: string
  deletedAt: string | null
}

function entryFromChecklist(item: ChecklistItem): TrashEntry {
  return {
    id: item.id,
    kind: 'checklist_items',
    label: item.content,
    deletedAt: item.deleted_at ?? null,
  }
}

function entryFromIssue(item: Issue): TrashEntry {
  return {
    id: item.id,
    kind: 'issues',
    label: item.title,
    deletedAt: item.deleted_at ?? null,
  }
}

export function TrashView() {
  const [items, setItems] = useState<TrashEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  const loadTrash = async () => {
    const client = createClient()
    const [checklist, issues] = await Promise.all([
      client
        .from('checklist_items')
        .select('*')
        .not('deleted_at', 'is', null),
      client.from('issues').select('*').not('deleted_at', 'is', null),
    ])
    if (checklist.error) {
      toast.error('체크리스트 불러오기 실패')
      return
    }
    if (issues.error) {
      toast.error('이슈 불러오기 실패')
      return
    }
    const entries: TrashEntry[] = [
      ...((checklist.data ?? []) as ChecklistItem[]).map(entryFromChecklist),
      ...((issues.data ?? []) as Issue[]).map(entryFromIssue),
    ]
    // 삭제일 내림차순
    entries.sort((a, b) => {
      const at = a.deletedAt ? Date.parse(a.deletedAt) : 0
      const bt = b.deletedAt ? Date.parse(b.deletedAt) : 0
      return bt - at
    })
    setItems(entries)
    setLoaded(true)
  }

  const handleRestore = async (entry: TrashEntry) => {
    setRestoringId(entry.id)
    try {
      const client = createClient()
      await ensureContext(client)
      const { error } = await client
        .from(entry.kind)
        .update({ deleted_at: null })
        .eq('id', entry.id)
      if (error) throw error
      toast.success('복원되었습니다.')
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues })
      void router.refresh()
      setItems((prev) => prev.filter((i) => i.id !== entry.id))
    } catch {
      toast.error('복원 실패')
    } finally {
      setRestoringId(null)
    }
  }

  if (!loaded) {
    return <Button onClick={loadTrash}>삭제된 항목 불러오기</Button>
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">휴지통이 비어 있습니다.</p>
        <Button variant="outline" size="sm" onClick={loadTrash}>
          <RefreshCw className="mr-1 h-3 w-3" />
          새로고침
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadTrash}>
          <RefreshCw className="mr-1 h-3 w-3" />
          새로고침
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((entry) => (
          <div
            key={`${entry.kind}-${entry.id}`}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
              {entry.kind === 'checklist_items' ? '체크리스트' : '이슈'}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {entry.label}
            </span>
            {entry.deletedAt && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(parseISO(entry.deletedAt), 'yyyy. M. d. a h:mm', {
                  locale: ko,
                })}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={restoringId === entry.id}
              onClick={() => handleRestore(entry)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              복원
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
