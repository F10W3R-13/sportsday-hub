import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { ChecklistItem } from '@/lib/types/models'

const SECTION_LABEL: Record<string, string> = {
  progress: '진행 체크리스트',
  feedback: '피드백 반영',
  prep: '준비',
}

export function ChecklistPanel({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  const bySection = items.reduce(
    (acc, item) => {
      ;(acc[item.section] ??= []).push(item)
      return acc
    },
    {} as Record<string, ChecklistItem[]>
  )

  return (
    <div className="space-y-6">
      {Object.entries(bySection).map(([section, sectionItems]) => (
        <div key={section}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {SECTION_LABEL[section] ?? section} ({sectionItems.filter((i) => i.completed).length}/
            {sectionItems.length})
          </h3>
          <div className="space-y-1">
            {sectionItems
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-2"
                >
                  <Checkbox checked={item.completed} disabled />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <span
                        className={`text-sm ${
                          item.completed ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {item.content}
                      </span>
                    </div>
                    {item.source && (
                      <span className="text-xs text-muted-foreground">
                        출처: {item.source}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
