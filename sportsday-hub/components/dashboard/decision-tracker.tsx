import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import type { Decision } from '@/lib/types/models'

export function DecisionTracker({ decisions }: { decisions: Decision[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>핵심 결정 추적표</CardTitle>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <EmptyState title="결정 항목이 없습니다" />
        ) : (
          <div className="space-y-2">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                  {d.id}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  {d.current_value && (
                    <div className="truncate text-xs text-muted-foreground">
                      {d.current_value}
                    </div>
                  )}
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
