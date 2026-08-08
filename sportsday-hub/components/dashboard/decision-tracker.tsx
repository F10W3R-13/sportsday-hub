'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { DecisionStatusSelect } from '@/components/editor/decision-status-select'
import { InlineTextEdit } from '@/components/editor/inline-text-edit'
import { useUpdateDecision } from '@/lib/mutations/decisions'
import type { Decision } from '@/lib/types/models'

export function DecisionTracker({ decisions }: { decisions: Decision[] }) {
  const updateDecision = useUpdateDecision()

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
                  <InlineTextEdit
                    value={d.current_value}
                    placeholder="미정"
                    onSave={(value) =>
                      updateDecision.mutate({
                        id: d.id,
                        currentValue: value,
                      })
                    }
                  />
                </div>
                <DecisionStatusSelect decision={d} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
