import { notFound } from 'next/navigation'
import { TeamTabs } from '@/components/team/team-tabs'
import { getTeam } from '@/lib/queries/teams'
import { getChecklistByTeam } from '@/lib/queries/checklist'
import { getMilestones, getMilestonesByTeam } from '@/lib/queries/milestones'
import { getIssuesByTeam } from '@/lib/queries/issues'
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

  // milestones: 이 팀이 소유한 마일스톤만(MilestonePanel 탭은 팀 범위 유지).
  // allMilestones: 모든 팀의 마일스톤 — ChecklistPanel에서 다른 팀 소유
  // 마일스톤 아래에 배정된 체크리스트 항목(예: 예산팀 항목 → 컨텐츠팀 마일스톤)의
  // 라벨을 "상시"로 잘못 빠뜨리지 않도록 함께 전달.
  const [checklist, milestones, allMilestones, issues, driveFiles] =
    await Promise.all([
      getChecklistByTeam(id as (typeof TEAM_IDS)[number]),
      getMilestonesByTeam(id as (typeof TEAM_IDS)[number]),
      getMilestones(),
      getIssuesByTeam(id as (typeof TEAM_IDS)[number]),
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
        allMilestones={allMilestones}
        issues={issues}
        driveFiles={driveFiles}
      />
    </div>
  )
}
