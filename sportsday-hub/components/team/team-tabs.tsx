'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuidelineViewer } from './guideline-viewer'
import { ChecklistPanel } from './checklist-panel'
import { IssuePanel } from './issue-panel'
import { FileList } from '@/components/drive/file-list'
import { computeProgress } from '@/lib/progress'
import { readableColor } from '@/lib/color'
import type { Team, Milestone, Issue, DriveFile } from '@/lib/types/models'

const TAB_VALUES = ['overview', 'guideline', 'checklist', 'issues'] as const
type TabValue = (typeof TAB_VALUES)[number]

interface TeamTabsProps {
  team: Team
  // 통합 작업 엔터티(마일스톤, 구 checklist_items 포함) — 체크리스트 탭 단일 소스
  tasks: Milestone[]
  issues: Issue[]
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

function TeamTabsInner({ team, tasks, issues, driveFiles }: TeamTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { completed, percent: progress } = computeProgress(tasks)

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
          체크리스트 ({completed}/{tasks.length})
        </TabsTrigger>
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
            {/* 큰 텍스트(2xl bold) 기준 AA 3:1 충족하도록 보정 */}
            <span
              className="text-2xl font-bold"
              style={{ color: readableColor(team.color, 3) }}
            >
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
          tasks={tasks}
          teamId={team.id}
          focusItemId={focusItemId}
        />
      </TabsContent>

      <TabsContent value="issues" className="mt-4">
        <IssuePanel issues={issues} teamId={team.id} />
      </TabsContent>
    </Tabs>
  )
}
