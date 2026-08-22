import { TimelineList } from '@/components/timeline/timeline-list'
import { getMilestones } from '@/lib/queries/milestones'
import { getTeams } from '@/lib/queries/teams'

export default async function TimelinePage() {
  const [tasks, teams] = await Promise.all([getMilestones(), getTeams()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">타임라인</h1>
        <p className="text-sm text-muted-foreground">체크리스트 (시간순)</p>
      </div>
      <TimelineList tasks={tasks} teams={teams} />
    </div>
  )
}
