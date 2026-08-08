import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/shared/empty-state'
import type { Milestone, Team } from '@/lib/types/models'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

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

export function TimelineList({
  milestones,
  teams,
}: {
  milestones: Milestone[]
  teams: Team[]
}) {
  if (milestones.length === 0) {
    return <EmptyState title="마일스톤이 없습니다" />
  }
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))

  // 월별 그룹핑
  const byMonth = new Map<string, Milestone[]>()
  for (const m of sorted) {
    const monthKey = format(parseISO(m.date), 'yyyy-MM')
    ;(byMonth.get(monthKey) ?? byMonth.set(monthKey, []).get(monthKey)!).push(m)
  }

  return (
    <div className="space-y-6">
      {Array.from(byMonth.entries()).map(([month, items]) => (
        <div key={month}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {format(parseISO(`${month}-01`), 'yyyy년 M월', { locale: ko })}
          </h3>
          <div className="space-y-1">
            {items.map((m) => {
              const team = m.team_id ? teamMap.get(m.team_id) : null
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md border p-2"
                >
                  <Checkbox checked={m.completed} disabled />
                  <span className="w-24 shrink-0 text-sm font-medium">
                    {format(parseISO(m.date), 'M/d (E)', { locale: ko })}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${
                      CATEGORY_STYLE[m.category] ?? ''
                    }`}
                  >
                    {CATEGORY_LABEL[m.category] ?? m.category}
                  </span>
                  <span className="min-w-0 truncate flex-1 text-sm">{m.title}</span>
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
        </div>
      ))}
    </div>
  )
}
