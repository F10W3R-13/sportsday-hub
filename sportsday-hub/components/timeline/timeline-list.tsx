'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Settings2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { TeamBadge } from '@/components/shared/team-badge'
import { EditableTaskCheckbox } from '@/components/editor/editable-checkbox'
import type { Milestone, Team } from '@/lib/types/models'
import { computeProgress } from '@/lib/progress'

const CATEGORY_LABEL: Record<string, string> = {
  meeting: '회의',
  deliverable: '산출물',
  event: '행사',
}

const CATEGORY_STYLE: Record<string, string> = {
  meeting: 'bg-purple-100 text-purple-800',
  deliverable: 'bg-blue-100 text-blue-800',
  event: 'bg-red-100 text-red-800',
}

type Filter = 'all' | 'incomplete' | 'complete'

export function TimelineList({ tasks, teams }: { tasks: Milestone[]; teams: Team[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const teamMap: Map<string, Team> = new Map(teams.map((t) => [t.id, t]))

  const filtered = useMemo(
    () =>
      tasks.filter((t) =>
        filter === 'all' ? true : filter === 'complete' ? t.completed : !t.completed
      ),
    [tasks, filter]
  )

  // 월 그룹: date 있는 것 yyyy-MM 기준 / 없는 것 '상시' 버킷 (맨 앞)
  const byMonth = useMemo(() => {
    const map = new Map<string, Milestone[]>()
    for (const t of filtered) {
      if (!t.date) continue
      const key = format(parseISO(t.date), 'yyyy-MM')
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [filtered])

  const undated = useMemo(() => filtered.filter((t) => !t.date), [filtered])

  const {
    completed: completedCount,
    total: totalCount,
    percent: progressPercent,
  } = computeProgress(tasks)

  if (tasks.length === 0) {
    return <EmptyState title="체크리스트가 없습니다" />
  }

  return (
    <div className="space-y-4">
      {/* 진행률 바 */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-medium">
          {completedCount}/{totalCount} ({progressPercent}%)
        </span>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {(
          [
            ['all', '전체'],
            ['incomplete', '미완료'],
            ['complete', '완료'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm transition-colors sm:flex-none md:min-h-9 md:px-3 ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 상시 버킷 (맨 앞) */}
      {undated.length > 0 && (
        <section aria-label="상시 항목">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Settings2 className="size-3.5" aria-hidden />
            상시 / 특정 시점 없음
          </h3>
          <div className="space-y-1 rounded-lg border border-dashed p-3">
            {undated.map((t) => (
              <TaskRow key={t.id} task={t} team={t.team_id ? teamMap.get(t.team_id) : null} />
            ))}
          </div>
        </section>
      )}

      {/* 월별 섹션 */}
      {Array.from(byMonth.entries()).map(([month, monthTasks]) => (
        <section key={month} aria-label={month}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {format(parseISO(`${month}-01`), 'yyyy년 M월', { locale: ko })}
          </h3>
          <div className="space-y-1">
            {monthTasks.map((t) => (
              <TaskRow key={t.id} task={t} team={t.team_id ? teamMap.get(t.team_id) : null} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ===== 플랫 작업 행 =====
function TaskRow({
  task,
  team,
}: {
  task: Milestone
  team: Team | null | undefined
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-2">
      <EditableTaskCheckbox task={task} label={`${task.title} 완료 여부`} />
      <span className="w-16 shrink-0 pt-0.5 text-sm font-medium tabular-nums">
        {task.date ? format(parseISO(task.date), 'M/d', { locale: ko }) : '상시'}
      </span>
      <PriorityBadge priority={task.priority ?? null} />
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
          CATEGORY_STYLE[task.category] ?? ''
        }`}
      >
        {CATEGORY_LABEL[task.category] ?? task.category}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          task.completed ? 'text-muted-foreground line-through' : ''
        }`}
      >
        {task.title}
      </span>
      {team && <TeamBadge name={team.name} color={team.color} />}
    </div>
  )
}
