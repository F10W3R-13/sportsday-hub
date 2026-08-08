import { TimelineList } from '@/components/timeline/timeline-list'
import { getMilestones } from '@/lib/queries/milestones'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getTeams } from '@/lib/queries/teams'

export default async function TimelinePage() {
  const [milestones, checklistItems, teams] = await Promise.all([
    getMilestones(),
    getChecklistItems(),
    getTeams(),
  ])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">타임라인</h1>
        <p className="text-sm text-muted-foreground">
          마일스톤 & 체크리스트 (시간순)
        </p>
      </div>
      <TimelineList
        milestones={milestones}
        checklistItems={checklistItems}
        teams={teams}
      />
    </div>
  )
}
