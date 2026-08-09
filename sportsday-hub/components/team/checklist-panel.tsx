'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { EditableChecklistCheckbox } from '@/components/editor/editable-checkbox'
import { AddItemButton } from '@/components/editor/add-item-button'
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
} from '@/lib/mutations/checklist'
import type { ChecklistItem, Milestone, TeamId } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function ChecklistPanel({
  items,
  milestones,
  teamId,
}: {
  items: ChecklistItem[]
  milestones: Milestone[]
  teamId: TeamId | null
}) {
  const addItem = useAddChecklistItem()
  const deleteItem = useDeleteChecklistItem()

  if (items.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  const milestoneMap = new Map(milestones.map((m) => [m.id, m]))

  // milestone_id로 그룹핑 (null = 상시)
  const groups = new Map<string | null, ChecklistItem[]>()
  for (const item of items) {
    const key = item.milestone_id
    const arr = groups.get(key) ?? []
    arr.push(item)
    groups.set(key, arr)
  }

  // 마일스톤은 날짜순, 상시(null)는 맨 앞
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === null) return -1
    if (b === null) return 1
    const ma = milestoneMap.get(a)
    const mb = milestoneMap.get(b)
    if (!ma || !mb) return 0
    return ma.date.localeCompare(mb.date)
  })

  return (
    <div className="space-y-6">
      {sortedKeys.map((key) => {
        const groupItems = (groups.get(key) ?? []).sort(
          (a, b) => a.sort_order - b.sort_order
        )
        const completed = groupItems.filter((i) => i.completed).length
        const milestone = key ? milestoneMap.get(key) : null
        const label = milestone
          ? `${format(parseISO(milestone.date), 'M/d (E)', { locale: ko })} · ${milestone.title}`
          : '⚙ 상시 / 특정 시점 없음'

        return (
          <div key={key ?? 'unassigned'}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              {label} ({completed}/{groupItems.length})
            </h3>
            <div className="space-y-1">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-2"
                >
                  <EditableChecklistCheckbox item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <span
                        className={`text-sm ${
                          item.completed
                            ? 'text-muted-foreground line-through'
                            : ''
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
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deleteItem.isPending}
                    onClick={() => deleteItem.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {teamId && (
              <AddItemButton
                onAdd={(content) =>
                  addItem.mutate({
                    teamId,
                    milestoneId: key,
                    content,
                  })
                }
                label="항목 추가"
                placeholder="새 체크리스트 항목..."
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
