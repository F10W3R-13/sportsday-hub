'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuidelineViewer } from './guideline-viewer'
import { ChecklistPanel } from './checklist-panel'
import { MilestonePanel } from './milestone-panel'
import { IssuePanel } from './issue-panel'
import { FileList } from '@/components/drive/file-list'
import type { Team, ChecklistItem, Milestone, Issue, DriveFile } from '@/lib/types/models'

export function TeamTabs({
  team,
  checklist,
  milestones,
  issues,
  driveFiles,
}: {
  team: Team
  checklist: ChecklistItem[]
  milestones: Milestone[]
  issues: Issue[]
  activityFeed?: never
  driveFiles: DriveFile[]
}) {
  const completed = checklist.filter((c) => c.completed).length
  const progress =
    checklist.length > 0
      ? Math.round((completed / checklist.length) * 100)
      : 0

  return (
    <Tabs defaultValue="overview" className="w-full">
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
        <ChecklistPanel items={checklist} teamId={team.id} />
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
