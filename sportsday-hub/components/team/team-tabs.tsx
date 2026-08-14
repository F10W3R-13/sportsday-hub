'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuidelineViewer } from './guideline-viewer'
import { ChecklistPanel } from './checklist-panel'
import { MilestonePanel } from './milestone-panel'
import { IssuePanel } from './issue-panel'
import { FileList } from '@/components/drive/file-list'
import { computeProgress } from '@/lib/progress'
import type { Team, ChecklistItem, Milestone, Issue, DriveFile } from '@/lib/types/models'

const TAB_VALUES = ['overview', 'guideline', 'checklist', 'milestones', 'issues'] as const
type TabValue = (typeof TAB_VALUES)[number]

interface TeamTabsProps {
  team: Team
  checklist: ChecklistItem[]
  milestones: Milestone[]
  // ChecklistPanel은 다른 팀 소유 마일스톤 아래 배정된 항목까지 올바른 라벨을
  // 표시해야 하므로 전체 마일스톤을 받는다. MilestonePanel은 여전히 milestones
  // (팀 범위)를 사용한다.
  allMilestones: Milestone[]
  issues: Issue[]
  activityFeed?: never
  driveFiles: DriveFile[]
}

// useSearchParams는 정적 페이지(generateStaticParams)에서 Suspense 경계 필수.
export function TeamTabs(props: TeamTabsProps) {
  return (
    <Suspense fallback={null}>
      <TeamTabsInner {...props} />
    </Suspense>
  )
}

function TeamTabsInner({
  team,
  checklist,
  milestones,
  allMilestones,
  issues,
  driveFiles,
}: TeamTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { completed, percent: progress } = computeProgress(checklist)

  // 탭 상태는 URL(?tab=)이 진실 원천 — 로컬 state 중복 없음. 무효 값은 개요 폴백.
  const tabParam = searchParams.get('tab')
  const value: TabValue = (TAB_VALUES as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as TabValue)
    : 'overview'

  const handleTabChange = (next: string) => {
    // 수동 전환 시 ?focus= 제거 — 과거 포커스 항목으로 재스크롤 방지.
    // replace라 히스토리에 쌓이지 않고 scroll:false로 스크롤 점프도 없음.
    router.replace(`${pathname}?tab=${next}`, { scroll: false })
  }

  const focusItemId = searchParams.get('focus')

  return (
    <Tabs value={value} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full overflow-x-auto">
        <TabsTrigger className="shrink-0" value="overview">개요</TabsTrigger>
        <TabsTrigger className="shrink-0" value="guideline">지침</TabsTrigger>
        <TabsTrigger className="shrink-0" value="checklist">
          체크리스트 ({completed}/{checklist.length})
        </TabsTrigger>
        <TabsTrigger className="shrink-0" value="milestones">마일스톤</TabsTrigger>
        <TabsTrigger className="shrink-0" value="issues">이슈 ({issues.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">미션</h3>
          <p className="text-sm text-muted-foreground">{team.mission}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">진행률</h3>
            <span className="text-2xl font-bold" style={{ color: team.color }}>
              {progress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: team.color }}
            />
          </div>
        </div>

        <FileList files={driveFiles} teamId={team.id} />
      </TabsContent>

      <TabsContent value="guideline" className="mt-4">
        <GuidelineViewer team={team} teamId={team.id} />
      </TabsContent>

      <TabsContent value="checklist" className="mt-4">
        <ChecklistPanel
          items={checklist}
          milestones={allMilestones}
          teamId={team.id}
          focusItemId={focusItemId}
        />
      </TabsContent>

      <TabsContent value="milestones" className="mt-4">
        <MilestonePanel milestones={milestones} />
      </TabsContent>

      <TabsContent value="issues" className="mt-4">
        <IssuePanel issues={issues} teamId={team.id} />
      </TabsContent>
    </Tabs>
  )
}
