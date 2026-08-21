import { StatsCards } from '@/components/dashboard/stats-cards'
import { DecisionTracker } from '@/components/dashboard/decision-tracker'
import { TeamStatusCard } from '@/components/dashboard/team-status-card'
import { UpcomingMilestones } from '@/components/dashboard/upcoming-milestones'
import { UrgentChecklist } from '@/components/dashboard/urgent-checklist'
import { RecentFilesWidget } from '@/components/drive/recent-files-widget'
import { HandoffsWidget } from '@/components/handoffs/handoffs-widget'
import { getDecisions } from '@/lib/queries/decisions'
import { getTeams } from '@/lib/queries/teams'
import { getMilestones } from '@/lib/queries/milestones'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getIssues } from '@/lib/queries/issues'
import { getRecentDriveFiles, getLastSyncedAt } from '@/lib/queries/drive-files'
import { getHandoffs } from '@/lib/queries/handoffs'
import { getDriveConnectionStatus } from '@/lib/drive/sync'
import { sortByUrgency } from '@/lib/milestones-urgency'

export default async function DashboardPage() {
  const [
    decisions,
    teams,
    milestones,
    checklist,
    issues,
    recentFiles,
    lastSyncedAt,
    driveStatus,
    handoffs,
  ] = await Promise.all([
    getDecisions(),
    getTeams(),
    getMilestones(),
    getChecklistItems(),
    getIssues(),
    getRecentDriveFiles(50),
    getLastSyncedAt(),
    // 상태 조회 실패(토큰 복호화 오류 등)는 미연결로 취급 — 페이지 전체가 죽지 않도록 (스펙 §7)
    getDriveConnectionStatus().catch(() => ({ connected: false, email: null })),
    // handoffs 테이블 부재(마이그레이션 미적용 배포) 시 빈 위젯으로 폴백 (스펙 §7)
    getHandoffs().catch(() => []),
  ])

  // 대시보드 위젯 간 중복 방지 — UpcomingMilestones와 동일한 정렬로 상위 5개 마일스톤 id 산출
  const topMilestoneIds = sortByUrgency(milestones, new Date())
    .slice(0, 5)
    .map(({ milestone }) => milestone.id)

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
          excludeMilestoneIds={topMilestoneIds}
        />
      </div>

      <RecentFilesWidget
        files={recentFiles.slice(0, 8)}
        lastSyncedAt={lastSyncedAt}
        connected={driveStatus.connected}
      />

      <HandoffsWidget handoffs={handoffs} recentFiles={recentFiles} />

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
