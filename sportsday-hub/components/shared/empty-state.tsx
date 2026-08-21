import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  title = '데이터가 없습니다',
  description,
  action,
}: {
  title?: string
  description?: string
  /** 빈 상태에서 사용자가 취할 다음 행동 (예: 추가 버튼) */
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
