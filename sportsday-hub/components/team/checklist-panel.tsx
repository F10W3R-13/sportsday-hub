'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useToggleMilestone,
} from '@/lib/mutations/milestones'
import {
  PRIORITY,
  PRIORITY_LABEL,
  type Milestone,
  type Priority,
  type TeamId,
} from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

// 날짜순(date nulls last) + sort_order 정렬 — 쿼리 결과에도 동일 정렬이 있지만
// 낙관 업데이트·클라이언트 조합 시 순서를 보장하기 위해 렌더 직전에 다시 정렬.
function sortTasks(tasks: Milestone[]): Milestone[] {
  const bySortOrder = (a: Milestone, b: Milestone) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0)
  return [...tasks].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || bySortOrder(a, b)
    if (!a.date && !b.date) return bySortOrder(a, b)
    return a.date ? -1 : 1
  })
}

export function ChecklistPanel({
  tasks,
  teamId,
  focusItemId = null,
}: {
  tasks: Milestone[]
  teamId: TeamId | null
  // 대시보드 긴급 위젯 딥링크(?focus=) 도착 시 스크롤+하이라이트 대상 항목 ID
  focusItemId?: string | null
}) {
  const addItem = useCreateMilestone()
  const deleteItem = useDeleteMilestone()
  const toggle = useToggleMilestone()

  // 낙관적 오버라이드: 체크 토글을 즉시 화면에 반영하기 위한 taskId → completed 맵.
  // DB가 진실 원천; 이 맵은 화면 미리보기일 뿐이고 DB는 건드리지 않음.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  // 진행 중인 토글 task (해당 체크박스만 비활성화 → 연속 체크 허용)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // SSR이 낙관적 값을 따라잡으면(refresh로 tasks가 갱신) 낡은 override 정리.
  // effect+setState 대신 "직전 렌더의 props 기억" 패턴으로 렌더 중 처리
  // (react-hooks/set-state-in-effect 회피 + React 공식 권장 패턴).
  const [prevTasks, setPrevTasks] = useState(tasks)
  if (tasks !== prevTasks) {
    setPrevTasks(tasks)
    let changed = false
    const next: Record<string, boolean> = {}
    for (const [id, val] of Object.entries(overrides)) {
      const ssrTask = tasks.find((t) => t.id === id)
      if (ssrTask && ssrTask.completed === val) {
        changed = true // SSR이 따라잡음 → 제거
      } else {
        next[id] = val
      }
    }
    if (changed) setOverrides(next)
  }

  // 딥링크 도착: 대상 항목을 화면 중앙으로 부드럽게. 요소가 없으면(삭제된
  // 항목 등) 조용히 무시. setState 없음 — set-state-in-effect 회피.
  useEffect(() => {
    if (!focusItemId) return
    document
      .getElementById(`checklist-item-${focusItemId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusItemId])

  // effectiveTasks = SSR tasks를 낙관적 override로 덮은 버전
  const effectiveTasks = sortTasks(tasks).map((t) =>
    overrides[t.id] !== undefined ? { ...t, completed: overrides[t.id] } : t
  )

  const handleToggle = (task: Milestone) => {
    const newCompleted = !task.completed
    setOverrides((prev) => ({ ...prev, [task.id]: newCompleted }))
    setPendingId(task.id)
    toggle.mutate(task, {
      onError: () =>
        // 저장 실패 → 화면 미리보기만 롤백 (DB는 처음부터 안 바뀜)
        setOverrides((prev) => {
          const next = { ...prev }
          delete next[task.id]
          return next
        }),
      onSettled: () => setPendingId(null),
    })
  }

  if (tasks.length === 0) {
    return <EmptyState title="체크리스트 항목이 없습니다" />
  }

  return (
    <div className="space-y-1">
      {effectiveTasks.map((task) => (
        <div
          key={task.id}
          id={`checklist-item-${task.id}`}
          className={`flex items-start gap-3 rounded-md border p-2 ${
            task.id === focusItemId ? 'checklist-focus-flash' : ''
          }`}
        >
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleToggle(task)}
            disabled={pendingId === task.id}
            className="mt-0.5"
            aria-label={`${task.title} 완료 여부`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={task.priority ?? null} />
              <span
                className={`text-sm ${
                  task.completed ? 'text-muted-foreground line-through' : ''
                }`}
              >
                {task.title}
              </span>
            </div>
            {task.source && (
              <span className="text-xs text-muted-foreground">
                출처: {task.source}
              </span>
            )}
          </div>
          {/* 날짜 배지 — null(상시) 항목도 배지로 표현해 목록 리듬 유지 */}
          <span className="w-20 shrink-0 text-right text-xs font-medium text-muted-foreground">
            {task.date
              ? format(parseISO(task.date), 'M/d (E)', { locale: ko })
              : '상시'}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={deleteItem.isPending}
            onClick={() => deleteItem.mutate(task.id)}
            aria-label={`${task.title} 삭제`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {teamId && <AddTaskForm teamId={teamId} addItem={addItem} />}
    </div>
  )
}

// 추가 폼 — 기존 AddItemButton의 열기/닫기 패턴 유지 + priority/date 선택 옵션.
function AddTaskForm({
  teamId,
  addItem,
}: {
  teamId: string
  addItem: ReturnType<typeof useCreateMilestone>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority | 'none'>('none')
  const [date, setDate] = useState('')

  const reset = () => {
    setTitle('')
    setPriority('none')
    setDate('')
  }

  const handleAdd = () => {
    const trimmed = title.trim()
    if (!trimmed || addItem.isPending) return
    addItem.mutate(
      {
        teamId,
        title: trimmed,
        date: date || undefined,
        priority: priority === 'none' ? undefined : priority,
      },
      { onSuccess: () => setOpen(false) }
    )
    reset()
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        항목 추가
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="새 체크리스트 항목..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') {
            reset()
            setOpen(false)
          }
        }}
        autoFocus
        className="h-9 min-w-40 flex-1"
      />
      <Select
        value={priority}
        onValueChange={(v) => setPriority(v as Priority | 'none')}
      >
        <SelectTrigger size="sm" className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">미지정</SelectItem>
          {PRIORITY.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-9 w-36 shrink-0"
      />
      <Button size="sm" onClick={handleAdd}>
        추가
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          reset()
          setOpen(false)
        }}
      >
        취소
      </Button>
    </div>
  )
}
