'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { sortByUrgency } from '@/lib/milestones-urgency'
import type { Milestone, Team } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

const TIER_LABEL: Record<string, { text: string; className: string }> = {
  overdue: {
    text: '지연',
    className: 'text-red-600',
  },
  today: {
    text: '오늘',
    className: 'text-orange-600',
  },
  upcoming: {
    text: '',
    className: '',
  },
}

export function UpcomingMilestones({
  milestones,
  teams,
}: {
  milestones: Milestone[]
  teams: Team[]
}) {
  // 자정 경과 시 분류가 바뀌어야 하므로 주기적 갱신.
  // sortByUrgency가 내부에서 오늘 자정을 계산하므로 now는 날짜만 바뀌면 의미 있음.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const sorted = sortByUrgency(milestones, now).slice(0, 5)

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>다가오는 마일스톤</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState title="예정된 마일스톤이 없습니다" />
        ) : (
          <div className="space-y-2">
            {sorted.map(({ milestone: m, tier, daysFromToday }) => {
              const team = m.team_id ? teamMap.get(m.team_id) : null
              const badge = TIER_LABEL[tier]
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm ${
                    tier === 'overdue' ? 'border-red-300 bg-red-50' : ''
                  }`}
                >
                  <span
                    className={`w-20 shrink-0 font-medium ${
                      tier === 'overdue' ? 'text-red-600' : ''
                    }`}
                  >
                    {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  {badge.text && (
                    <span
                      className={`shrink-0 text-xs font-medium ${badge.className}`}
                    >
                      {badge.text}
                      {tier === 'overdue' && ` ${Math.abs(daysFromToday)}일`}
                    </span>
                  )}
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
