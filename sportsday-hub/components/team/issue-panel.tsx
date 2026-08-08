import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { Issue } from '@/lib/types/models'

const STATUS_LABEL: Record<string, string> = {
  open: '열림',
  in_progress: '진행중',
  resolved: '해결됨',
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
}

export function IssuePanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <EmptyState title="이슈가 없습니다" description="모두 순조롭게 진행 중" />
  }
  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.id} className="flex items-center gap-3 rounded-md border p-3">
          <Badge variant="secondary" className={STATUS_STYLE[issue.status]}>
            {STATUS_LABEL[issue.status]}
          </Badge>
          <span className="min-w-0 flex-1 text-sm">{issue.title}</span>
          {issue.date && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {issue.date}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
