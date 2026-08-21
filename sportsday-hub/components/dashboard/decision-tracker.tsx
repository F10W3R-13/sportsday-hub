'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { DecisionStatusSelect } from '@/components/editor/decision-status-select'
import { InlineTextEdit } from '@/components/editor/inline-text-edit'
import { AddItemButton } from '@/components/editor/add-item-button'
import { Trash2 } from 'lucide-react'
import {
  useUpdateDecision,
  useAddDecision,
  useDeleteDecision,
} from '@/lib/mutations/decisions'
import { sortDecisions } from '@/lib/decisions-sort'
import type { Decision } from '@/lib/types/models'

export function DecisionTracker({ decisions }: { decisions: Decision[] }) {
  const updateDecision = useUpdateDecision()
  const addDecision = useAddDecision()
  const deleteDecision = useDeleteDecision()

  const sorted = sortDecisions(decisions)
  // 미확정/확정 경계 인덱스 — confirmed가 처음 나오는 위치
  const firstConfirmedIdx = sorted.findIndex((d) => d.status === 'confirmed')

  return (
    <Card>
      <CardHeader>
        <CardTitle>핵심 결정 추적표</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            title="결정 항목이 없습니다"
            description="회의에서 결정된 항목을 추가해 추적하세요"
            action={
              <AddItemButton
                onAdd={(title) => addDecision.mutate({ title })}
                label="결정 추가"
                placeholder="새 결정 항목 제목..."
              />
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {sorted.map((d, idx) => {
                const isSeed = /^D\d+$/.test(d.id)
                return (
                  <div key={d.id}>
                    {/* 미확정→확정 경계 구분선 */}
                    {idx === firstConfirmedIdx && firstConfirmedIdx > 0 && (
                      <div className="my-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">
                          확정
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      {isSeed ? (
                        <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                          {d.id}
                        </span>
                      ) : (
                        <span className="w-8 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {d.title}
                        </div>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${d.title} 삭제`}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deleteDecision.isPending}
                        onClick={() => deleteDecision.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3">
              <AddItemButton
                onAdd={(title) => addDecision.mutate({ title })}
                label="결정 추가"
                placeholder="새 결정 항목 제목..."
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
