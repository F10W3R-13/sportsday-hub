'use client'

import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityBadge } from '@/components/shared/priority-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { ChecklistItem, Team, TeamId } from '@/lib/types/models'

export function UnifiedChecklist({
  items,
  teams,
}: {
  items: ChecklistItem[]
  teams: Team[]
}) {
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all')

  const filtered = useMemo(() => {
    if (filter === 'incomplete') return items.filter((i) => !i.completed)
    if (filter === 'complete') return items.filter((i) => i.completed)
    return items
  }, [items, filter])

  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const completed = items.filter((i) => i.completed).length
  const progress =
    items.length > 0 ? Math.round((completed / items.length) * 100) : 0

  // 팀별 그룹핑 (전체 건 team_id=null은 별도)
  const byTeam = new Map<TeamId | null, ChecklistItem[]>()
  for (const item of filtered) {
    const key = item.team_id
    ;(byTeam.get(key) ?? byTeam.set(key, []).get(key)!).push(item)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-medium">
          {completed}/{items.length} ({progress}%)
        </span>
      </div>

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

      {byTeam.size === 0 ? (
        <EmptyState title="해당 항목이 없습니다" />
      ) : (
        <Accordion className="w-full">
          {Array.from(byTeam.entries()).map(([teamId, teamItems]) => {
            const team = teamId ? teamMap.get(teamId) : null
            const teamCompleted = teamItems.filter((i) => i.completed).length
            return (
              <AccordionItem key={teamId ?? 'global'} value={teamId ?? 'global'}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    {team && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                    )}
                    {team?.name ?? '전체'}
                    <span className="text-xs text-muted-foreground">
                      ({teamCompleted}/{teamItems.length})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    {teamItems
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
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
