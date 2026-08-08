import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Team, ChecklistItem, Issue } from '@/lib/types/models'

export function TeamStatusCard({
  team,
  checklist,
  issues,
}: {
  team: Team
  checklist: ChecklistItem[]
  issues: Issue[]
}) {
  const teamChecks = checklist.filter((c) => c.team_id === team.id)
  const completed = teamChecks.filter((c) => c.completed).length
  const total = teamChecks.length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const openIssues = issues.filter(
    (i) => i.team_id === team.id && i.status !== 'resolved'
  ).length

  return (
    <Link href={`/team/${team.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="font-medium">{team.name}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <div>진행률 {progress}%</div>
            <div>
              체크 {completed}/{total}
            </div>
            <div>이슈 {openIssues}</div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, backgroundColor: team.color }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
