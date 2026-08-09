'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EditableChecklistCheckbox } from '@/components/editor/editable-checkbox'
import { EditableMilestoneCheckbox } from '@/components/editor/editable-checkbox'
import type { Milestone, ChecklistItem, Team } from '@/lib/types/models'
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

export function TimelineList({
  milestones,
  checklistItems,
  teams,
}: {
  milestones: Milestone[]
  checklistItems: ChecklistItem[]
  teams: Team[]
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  // 체크리스트를 milestone_id로 그룹핑
  const checklistByMilestone = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>()
    for (const item of checklistItems) {
      const key = item.milestone_id ?? '__unassigned__'
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return map
  }, [checklistItems])

  // 상시 버킷 (milestone_id가 null)
  const unassignedItems = useMemo(() => {
    let items = checklistByMilestone.get('__unassigned__') ?? []
    if (filter === 'incomplete') items = items.filter((i) => !i.completed)
    if (filter === 'complete') items = items.filter((i) => i.completed)
    return items
  }, [checklistByMilestone, filter])

  // 필터링된 마일스톤 + 하위 체크리스트
  const visibleMilestones = useMemo(() => {
    return milestones
      .filter((m) => {
        if (filter === 'all') return true
        const items = checklistByMilestone.get(m.id) ?? []
        // 하위 체크리스트가 있으면: 필터 조건 맞는 하위가 하나라도 있으면 표시
        if (items.length > 0) {
          return items.some((i) =>
            filter === 'incomplete' ? !i.completed : i.completed
          )
        }
        // 하위가 없으면: 마일스톤 자체의 completed로 판단
        return filter === 'incomplete' ? !m.completed : m.completed
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [milestones, checklistByMilestone, filter])

  // 월별 그룹핑
  const byMonth = useMemo(() => {
    const map = new Map<string, Milestone[]>()
    for (const m of visibleMilestones) {
      const monthKey = format(parseISO(m.date), 'yyyy-MM')
      const arr = map.get(monthKey) ?? []
      arr.push(m)
      map.set(monthKey, arr)
    }
    return map
  }, [visibleMilestones])

  // 전체 진행률 — 체크리스트만 기준 (마일스톤 자체 completed는 제외)
  const { completed: completedCount, total: totalCount, percent: progressPercent } = useMemo(
    () => computeProgress(checklistItems),
    [checklistItems],
  )

  if (milestones.length === 0 && checklistItems.length === 0) {
    return <EmptyState title="마일스톤과 체크리스트가 없습니다" />
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
            className={`rounded-md px-3 py-1 text-sm ${
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 상시 버킷 (맨 앞) */}
      {unassignedItems.length > 0 && (
        <UnassignedBucket items={unassignedItems} teamMap={teamMap} />
      )}

      {/* 월별 마일스톤 그룹 */}
      {Array.from(byMonth.entries()).map(([month, monthMilestones]) => (
        <div key={month}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {format(parseISO(`${month}-01`), 'yyyy년 M월', { locale: ko })}
          </h3>
          <div className="space-y-1">
            {monthMilestones.map((m) => {
              const subItems = checklistByMilestone.get(m.id) ?? []
              const subCompleted = subItems.filter((i) => i.completed).length
              return (
                <MilestoneRow
                  key={m.id}
                  milestone={m}
                  team={m.team_id ? teamMap.get(m.team_id) : null}
                  subItems={subItems}
                  subCompleted={subCompleted}
                  teamMap={teamMap}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== 상시 버킷 =====
function UnassignedBucket({
  items,
  teamMap,
}: {
  items: ChecklistItem[]
  teamMap: Map<string, Team>
}) {
  // 팀별 서브그룹핑
  const byTeam = new Map<string | null, ChecklistItem[]>()
  for (const item of items) {
    const key = item.team_id
    const arr = byTeam.get(key) ?? []
    arr.push(item)
    byTeam.set(key, arr)
  }

  return (
    <div className="rounded-lg border border-dashed p-3">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
        ⚙ 상시 / 특정 시점 없음
      </h3>
      <div className="space-y-3">
        {Array.from(byTeam.entries()).map(([teamId, teamItems]) => {
          const team = teamId ? teamMap.get(teamId) : null
          return (
            <div key={teamId ?? 'global'}>
              {team && (
                <span
                  className="mb-1 inline-block rounded px-1.5 py-0.5 text-xs"
                  style={{
                    backgroundColor: `${team.color}20`,
                    color: team.color,
                  }}
                >
                  {team.name}
                </span>
              )}
              <div className="space-y-1">
                {teamItems
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      team={item.team_id ? teamMap.get(item.team_id) : null}
                    />
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== 마일스톤 행 =====
function MilestoneRow({
  milestone,
  team,
  subItems,
  subCompleted,
  teamMap,
}: {
  milestone: Milestone
  team: Team | null | undefined
  subItems: ChecklistItem[]
  subCompleted: number
  teamMap: Map<string, Team>
}) {
  const hasSubItems = subItems.length > 0
  const [open, setOpen] = useState(true) // 기본 펼침

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-2">
        {/* 체크박스: 하위가 있으면 비활성(진행률 표시용), 없으면 편집 가능 */}
        {hasSubItems ? (
          <span className="text-xs text-muted-foreground">
            {subCompleted}/{subItems.length}
          </span>
        ) : (
          <EditableMilestoneCheckbox milestone={milestone} />
        )}
        <span className="w-24 shrink-0 text-sm font-medium">
          {format(parseISO(milestone.date), 'M/d (E)', { locale: ko })}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
            CATEGORY_STYLE[milestone.category] ?? ''
          }`}
        >
          {CATEGORY_LABEL[milestone.category] ?? milestone.category}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {milestone.title}
        </span>
        {team && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: `${team.color}20`,
              color: team.color,
            }}
          >
            {team.name}
          </span>
        )}
        {hasSubItems && (
          <button
            onClick={() => setOpen(!open)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                open ? '' : '-rotate-90'
              }`}
            />
          </button>
        )}
      </div>
      {/* 하위 체크리스트 */}
      {hasSubItems && open && (
        <div className="space-y-1 border-t bg-muted/30 p-2 pl-8">
          {subItems
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                team={item.team_id ? teamMap.get(item.team_id) : null}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ===== 체크리스트 행 (재사용) =====
function ChecklistRow({
  item,
  team,
}: {
  item: ChecklistItem
  team: Team | null | undefined
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-2">
      <EditableChecklistCheckbox item={item} />
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
      {team && (
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-xs"
          style={{
            backgroundColor: `${team.color}20`,
            color: team.color,
          }}
        >
          {team.name}
        </span>
      )}
    </div>
  )
}
