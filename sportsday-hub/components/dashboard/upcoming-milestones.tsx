'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone, Team } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function UpcomingMilestones({
  milestones,
  teams,
}: {
  milestones: Milestone[]
  teams: Team[]
}) {
  // 필터링 기준 시각. 자정 경과 등으로 '오늘 이후' 목록이 바뀌어야 하므로 주기적 갱신.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const upcoming = milestones
    .filter((m) => !m.completed && parseISO(m.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>다가오는 마일스톤</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <EmptyState title="예정된 마일스톤이 없습니다" />
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => {
              const team = m.team_id ? teamMap.get(m.team_id) : null
              return (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 font-medium">
                    {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
