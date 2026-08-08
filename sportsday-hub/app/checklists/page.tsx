import { UnifiedChecklist } from '@/components/checklist/unified-checklist'
import { getChecklistItems } from '@/lib/queries/checklist'
import { getTeams } from '@/lib/queries/teams'

export default async function ChecklistsPage() {
  const [items, teams] = await Promise.all([getChecklistItems(), getTeams()])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">체크리스트</h1>
        <p className="text-sm text-muted-foreground">
          전체 팀 체크리스트 통합 뷰
        </p>
      </div>
      <UnifiedChecklist items={items} teams={teams} />
    </div>
  )
}
