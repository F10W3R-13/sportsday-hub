import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { handoffUrgency } from '@/lib/handoff'
import { buildChecklistFocusUrl } from '@/lib/checklist-focus-url'
import { HandoffHint } from './handoff-hint'
import type { HandoffItem, RecentFileItem } from '@/lib/types/models'

// 인계 행 — 훅 없는 presentational이라 서버(위젯)·클라이언트(/handoffs) 양쪽 사용.
// 링크 대상은 행이 아니라 '관련 항목' 링크(폼 경로와 충돌 방지).
export function HandoffRow({
  handoff,
  hintFile,
  actions,
}: {
  handoff: HandoffItem
  hintFile?: RecentFileItem | null
  actions?: React.ReactNode
}) {
  const tier = handoffUrgency(handoff.due_date, handoff.completed)
  const dueLabel = handoff.due_date
    ? format(parseISO(handoff.due_date), 'M/d (E)', { locale: ko })
    : '—'
  const focusUrl =
    handoff.checklist_item_id && handoff.checklist_team_id
      ? buildChecklistFocusUrl(handoff.checklist_team_id, handoff.checklist_item_id)
      : null

  return (
    <div className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
      {handoff.completed ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
      ) : (
        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{handoff.title}</span>
          {handoff.to_team === null && handoff.to_external && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              외부
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: handoff.from_team.color }}
            />
            {handoff.from_team.name}
            <span className="mx-0.5">→</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: handoff.to_team?.color ?? '#94a3b8' }}
            />
            {handoff.to_team ? handoff.to_team.name : handoff.to_external}
          </span>
          <span className="text-muted-foreground">
            · {dueLabel}
            {tier === 'overdue' && !handoff.completed && ' 지연'}
          </span>
          {!handoff.completed && <HandoffHint file={hintFile} />}
        </div>
      </div>
      {focusUrl && (
        <Link
          href={focusUrl}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-primary hover:bg-muted transition-colors"
          title={handoff.checklist_content ?? '관련 체크리스트 항목'}
        >
          관련 항목 →
        </Link>
      )}
      {actions}
    </div>
  )
}
