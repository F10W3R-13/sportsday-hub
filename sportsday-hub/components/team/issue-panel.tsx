'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { AddItemButton } from '@/components/editor/add-item-button'
import {
  useAddIssue,
  useUpdateIssue,
  useDeleteIssue,
} from '@/lib/mutations/issues'
import type { Issue, IssueStatus, TeamId } from '@/lib/types/models'

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: '열림',
  in_progress: '진행중',
  resolved: '해결됨',
}

const STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved']

export function IssuePanel({
  issues,
  teamId,
}: {
  issues: Issue[]
  teamId: TeamId | null
}) {
  const addIssue = useAddIssue()
  const updateIssue = useUpdateIssue()
  const deleteIssue = useDeleteIssue()

  return (
    <div className="space-y-2">
      <AddItemButton
        onAdd={(title) => addIssue.mutate({ teamId, title })}
        label="이슈 추가"
        placeholder="새 이슈..."
      />
      {issues.length === 0 ? (
        <EmptyState title="이슈가 없습니다" description="모두 순조롭게 진행 중" />
      ) : (
        issues.map((issue) => (
          <div
            key={issue.id}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            <Select
              value={issue.status}
              onValueChange={(value) =>
                updateIssue.mutate({
                  id: issue.id,
                  status: value as IssueStatus,
                })
              }
            >
              <SelectTrigger size="sm" className="w-24">
                <SelectValue>
                  {(value: IssueStatus) => STATUS_LABEL[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="min-w-0 flex-1 text-sm">{issue.title}</span>
            {issue.date && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {issue.date}
              </span>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={deleteIssue.isPending}
              onClick={() => deleteIssue.mutate(issue.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}
