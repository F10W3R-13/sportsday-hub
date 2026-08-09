import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { computeProgress } from '@/lib/progress'
import type { Decision, ChecklistItem } from '@/lib/types/models'

export function StatsCards({
  decisions,
  checklist,
}: {
  decisions: Decision[]
  checklist: ChecklistItem[]
}) {
  const confirmed = decisions.filter((d) => d.status === 'confirmed').length
  const discussing = decisions.filter((d) => d.status === 'discussing').length
  const pending = decisions.filter(
    (d) => d.status === 'pending' || d.status === 'deferred'
  ).length
  const { percent: progress } = computeProgress(checklist)

  const cards = [
    { label: '확정 결정', value: confirmed, accent: 'text-green-600' },
    { label: '논의중', value: discussing, accent: 'text-yellow-600' },
    { label: '보류/미정', value: pending, accent: 'text-gray-500' },
    { label: '전체 진행률', value: `${progress}%`, accent: 'text-blue-600' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${c.accent}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
