'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TeamBadge } from '@/components/shared/team-badge'
import { EditableTaskCheckbox } from '@/components/editor/editable-checkbox'
import { sortByUrgency } from '@/lib/milestones-urgency'
import type { Milestone, Team } from '@/lib/types/models'

const MAX_VISIBLE = 8

/**
 * 긴급 체크리스트 — 통합 작업 엔터티(milestones)를 긴급도 순으로 하나의 위젯에 표시.
 * overdue/today 먼저, 이어서 다가오는 항목 상위 8개.
 * undated(상시) 항목은 마감일 정보가 없어 타임라인 담당이므로 제외.
 */
export function UrgentChecklist({
  tasks,
  teams,
}: {
  tasks: Milestone[]
  teams: Team[]
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const teamMap: Map<string, Team> = new Map(teams.map((t) => [t.id, t]))

  // 상위 표시 개수 카운트는 undated 제외 기준 — slice(N) 정보 은닉 방지
  const datedSorted = sortByUrgency(tasks, now).filter(
    ({ tier }) => tier !== 'undated',
  )
  const visible = datedSorted.slice(0, MAX_VISIBLE)

  const tierStyle = (tier: string): string => {
    if (tier === 'overdue') return 'border-red-300 bg-red-50'
    if (tier === 'today') return 'border-orange-200'
    return ''
  }
  const dateLabel = (tier: string, daysFromToday: number): string => {
    if (tier === 'overdue') return `지연 ${Math.abs(daysFromToday)}일`
    if (tier === 'today') return '오늘'
    if (tier === 'undated') return '상시'
    return `${daysFromToday}일 후`
  }
  const labelColor = (tier: string): string => {
    if (tier === 'overdue') return 'text-red-600'
    if (tier === 'today') return 'text-orange-600'
    return 'text-muted-foreground'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          긴급 체크리스트
          {datedSorted.length > visible.length && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              전체 {datedSorted.length}개 중 상위 {visible.length}개
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <EmptyState title="마감 임박 항목이 없습니다" />
        ) : (
          <div className="space-y-2">
            {visible.map(({ milestone, tier, daysFromToday }) => {
              const team = milestone.team_id ? teamMap.get(milestone.team_id) : null
              return (
                <div
                  key={milestone.id}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm ${tierStyle(tier)}`}
                >
                  <EditableTaskCheckbox task={milestone} />
                  <span className={`w-16 shrink-0 text-xs font-medium ${labelColor(tier)}`}>
                    {dateLabel(tier, daysFromToday)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{milestone.title}</span>
                  {team && <TeamBadge name={team.name} color={team.color} />}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
