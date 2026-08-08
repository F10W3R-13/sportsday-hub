import { notFound } from 'next/navigation'
import { TeamTabs } from '@/components/team/team-tabs'
import { getTeam } from '@/lib/queries/teams'
import { getChecklistByTeam } from '@/lib/queries/checklist'
import { getMilestonesByTeam } from '@/lib/queries/milestones'
import { getIssuesByTeam } from '@/lib/queries/issues'
import { getActivityFeed } from '@/lib/queries/activity-feed'
import { getDriveFilesByTeam } from '@/lib/queries/drive-files'
import { TEAM_IDS } from '@/lib/types/models'

export async function generateStaticParams() {
  return TEAM_IDS.map((id) => ({ id }))
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!TEAM_IDS.includes(id as (typeof TEAM_IDS)[number])) {
    notFound()
  }

  const team = await getTeam(id)
  if (!team) notFound()

  const [checklist, milestones, issues, activityFeed, driveFiles] = await Promise.all([
    getChecklistByTeam(id as (typeof TEAM_IDS)[number]),
    getMilestonesByTeam(id as (typeof TEAM_IDS)[number]),
    getIssuesByTeam(id as (typeof TEAM_IDS)[number]),
    getActivityFeed(id as (typeof TEAM_IDS)[number], 8),
    getDriveFilesByTeam(id as (typeof TEAM_IDS)[number]),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: team.color }}
        />
        <h1 className="text-2xl font-bold">{team.name}</h1>
      </div>
      <TeamTabs
        team={team}
        checklist={checklist}
        milestones={milestones}
        issues={issues}
        activityFeed={activityFeed}
        driveFiles={driveFiles}
      />
    </div>
  )
}
