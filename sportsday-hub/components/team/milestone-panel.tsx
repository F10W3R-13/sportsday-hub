import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const CATEGORY_LABEL: Record<string, string> = {
  meeting: '회의',
  deliverable: '산출물',
  event: '행사',
}

export function MilestonePanel({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <EmptyState title="마일스톤이 없습니다" />
  }
  return (
    <div className="space-y-2">
      {milestones.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
          <Checkbox checked={m.completed} disabled />
          <span className="w-24 shrink-0 text-sm font-medium">
            {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
          </span>
          <span className="min-w-0 flex-1 text-sm">{m.title}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {CATEGORY_LABEL[m.category] ?? m.category}
          </span>
        </div>
      ))}
    </div>
  )
}
