'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { AddItemButton } from '@/components/editor/add-item-button'
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useToggleCheck,
} from '@/lib/mutations/checklist'
import { shouldCompleteMilestone } from '@/lib/milestone-completion'
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
  const toggle = useToggleCheck()

  // 낙관적 오버라이드: 체크 토글을 즉시 화면에 반영하기 위한 itemId → completed 맵.
  // DB가 진실 원천(Phase 1 트리거); 이 맵은 화면 미리보기일 뿐이고 DB는 건드리지 않음.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  // 진행 중인 토글 item (해당 체크박스만 비활성화 → 연속 체크 허용)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // SSR이 낙관적 값을 따라잡으면(refresh로 items가 갱신) 낡은 override 정리.
  // effect+setState 대신 "직전 렌더의 props 기억" 패턴으로 렌더 중 처리
  // (react-hooks/set-state-in-effect 회피 + React 공식 권장 패턴).
  const [prevItems, setPrevItems] = useState(items)
  if (items !== prevItems) {
    setPrevItems(items)
    let changed = false
    const next: Record<string, boolean> = {}
    for (const [id, val] of Object.entries(overrides)) {
      const ssrItem = items.find((i) => i.id === id)
      if (ssrItem && ssrItem.completed === val) {
        changed = true // SSR이 따라잡음 → 제거
      } else {
        next[id] = val
      }
    }
    if (changed) setOverrides(next)
  }

  // effectiveItems = SSR items를 낙관적 override로 덮은 버전
  const effectiveItems = items.map((i) =>
    overrides[i.id] !== undefined ? { ...i, completed: overrides[i.id] } : i
  )

  const handleToggle = (item: ChecklistItem) => {
    const newCompleted = !item.completed
    setOverrides((prev) => ({ ...prev, [item.id]: newCompleted }))
    setPendingId(item.id)
    toggle.mutate(item, {
      onError: () =>
        // 저장 실패 → 화면 미리보기만 롤백 (DB는 처음부터 안 바뀜)
        setOverrides((prev) => {
          const next = { ...prev }
          delete next[item.id]
          return next
        }),
      onSettled: () => setPendingId(null),
    })
  }

  if (items.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  const milestoneMap = new Map(milestones.map((m) => [m.id, m]))

  // milestone_id로 그룹핑 (null = 상시) — effectiveItems 기준
  const groups = new Map<string | null, ChecklistItem[]>()
  for (const item of effectiveItems) {
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
        // 완료 표시: 마일스톤 그룹이고 자식 전부 완료면 (기존 순수함수 재사용)
        const isComplete = milestone
          ? shouldCompleteMilestone(milestone, effectiveItems)
          : false
        const label = milestone
          ? `${format(parseISO(milestone.date), 'M/d (E)', { locale: ko })} · ${milestone.title}`
          : '⚙ 상시 / 특정 시점 없음'

        return (
          <div key={key ?? 'unassigned'}>
            <h3
              className={`mb-2 text-sm font-semibold text-muted-foreground ${
                isComplete ? 'line-through' : ''
              }`}
            >
              {isComplete && '✓ '}
              {label} ({completed}/{groupItems.length})
            </h3>
            <div className="space-y-1">
              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-2"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={() => handleToggle(item)}
                    disabled={pendingId === item.id}
                  />
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
