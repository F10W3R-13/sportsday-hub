'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { sortByUrgency } from '@/lib/milestones-urgency'
import type { ChecklistItem, Milestone, Team } from '@/lib/types/models'
import Link from 'next/link'
import { buildChecklistFocusUrl } from '@/lib/checklist-focus-url'

/**
 * 긴급 체크리스트 — 미완료 체크리스트 항목 중 소속 마일스톤 날짜가 임박/지연인 것 상위 5개.
 * milestone_id가 없는(상시) 항목은 마감일 정보가 없으므로 제외.
 */
export function UrgentChecklist({
  checklist,
  milestones,
  teams,
}: {
  checklist: ChecklistItem[]
  milestones: Milestone[]
  teams: Team[]
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const teamMap = new Map(teams.map((t) => [t.id, t]))

  // 마일스톤 urgency 맵 (id → urgency 정보)
  const urgencyMap = useMemo(() => {
    const map = new Map<string, { tier: string; date: string; daysFromToday: number }>()
    for (const { milestone, tier, daysFromToday } of sortByUrgency(milestones, now)) {
      map.set(milestone.id, { tier, date: milestone.date, daysFromToday })
    }
    return map
  }, [milestones, now])

  // 미완료 + 마일스톤 연결된 항목을 urgency로 정렬
  const urgentAll = useMemo(() => {
    const tierOrder: Record<string, number> = {
      overdue: 0,
      today: 1,
      upcoming: 2,
    }
    return checklist
      .filter((c) => !c.completed && c.milestone_id && urgencyMap.has(c.milestone_id))
      .map((c) => {
        const u = urgencyMap.get(c.milestone_id!)!
        return { item: c, ...u }
      })
      .sort((a, b) => {
        const ta = tierOrder[a.tier] ?? 3
        const tb = tierOrder[b.tier] ?? 3
        if (ta !== tb) return ta - tb
        // 같은 tier면 날짜순
        return a.date.localeCompare(b.date)
      })
  }, [checklist, urgencyMap])
  // 위젯에는 상위 5개만 표시. 전체 개수(urgentAll.length)는 카운트 표시에 사용 —
  // 회고(2026-08-12)의 "slice(N) 정보 은닉" 지적 반영.
  const urgent = urgentAll.slice(0, 5)

  const tierStyle = (tier: string): string => {
    if (tier === 'overdue') return 'border-red-300 bg-red-50'
    if (tier === 'today') return 'border-orange-200'
    return ''
  }
  const dateLabel = (tier: string, daysFromToday: number): string => {
    if (tier === 'overdue') return `지연 ${Math.abs(daysFromToday)}일`
    if (tier === 'today') return '오늘 마감'
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
          {urgentAll.length > urgent.length && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              전체 {urgentAll.length}개 중 상위 {urgent.length}개
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {urgent.length === 0 ? (
          <EmptyState title="마감 임박 항목이 없습니다" />
        ) : (
          <div className="space-y-2">
            {urgent.map(({ item, tier, daysFromToday }) => {
              const team = item.team_id ? teamMap.get(item.team_id) : null
              const href = buildChecklistFocusUrl(item.team_id, item.id)
              const rowContent = (
                <>
                  <span className={`w-16 shrink-0 text-xs font-medium ${labelColor(tier)}`}>
                    {dateLabel(tier, daysFromToday)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.content}</span>
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
                </>
              )
              return href ? (
                <Link
                  key={item.id}
                  href={href}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-accent ${tierStyle(tier)}`}
                >
                  {rowContent}
                </Link>
              ) : (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm ${tierStyle(tier)}`}
                >
                  {rowContent}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
