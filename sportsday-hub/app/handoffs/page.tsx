import { HandoffsClient } from '@/components/handoffs/handoffs-client'
import { getHandoffs } from '@/lib/queries/handoffs'
import { getTeams } from '@/lib/queries/teams'
import { getMilestones } from '@/lib/queries/milestones'
import { getRecentDriveFiles } from '@/lib/queries/drive-files'

export default async function HandoffsPage() {
  const [handoffs, teams, milestones, recentFiles] = await Promise.all([
    getHandoffs(),
    getTeams(),
    getMilestones(),
    getRecentDriveFiles(50),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">인계</h1>
        <p className="text-sm text-muted-foreground">
          팀 간·외부 조직 인계 현황 · 기한순
        </p>
      </div>
      <HandoffsClient
        handoffs={handoffs}
        teams={teams}
        milestones={milestones}
        recentFiles={recentFiles}
      />
    </div>
  )
}
