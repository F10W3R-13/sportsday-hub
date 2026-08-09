import { StatsCards } from '@/components/dashboard/stats-cards'
import { DecisionTracker } from '@/components/dashboard/decision-tracker'
import { TeamStatusCard } from '@/components/dashboard/team-status-card'
import { UpcomingMilestones } from '@/components/dashboard/upcoming-milestones'
import { UrgentChecklist } from '@/components/dashboard/urgent-checklist'
import { getDecisions } from '@/lib/queries/decisions'
import { getTeams } from '@/lib/queries/teams'
import { getMilestones } from '@/lib/queries/milestones'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getIssues } from '@/lib/queries/issues'

export default async function DashboardPage() {
  const [decisions, teams, milestones, checklist, issues] = await Promise.all([
    getDecisions(),
    getTeams(),
    getMilestones(),
    getChecklistItems(),
    getIssues(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HI-Side Out</h1>
        <p className="text-sm text-muted-foreground">
          26-2 스포츠데이 기획 허브 · 2026. 9. 19 (토)
        </p>
      </div>

      <StatsCards decisions={decisions} checklist={checklist} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DecisionTracker decisions={decisions} />
        <UpcomingMilestones milestones={milestones} teams={teams} />
      </div>

      <div>
        <UrgentChecklist
          checklist={checklist}
          milestones={milestones}
          teams={teams}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">팀별 현황</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {teams.map((team) => (
            <TeamStatusCard
              key={team.id}
              team={team}
              checklist={checklist}
              issues={issues}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
