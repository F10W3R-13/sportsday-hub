import { PRIORITY_LABEL, type Priority } from '@/lib/types/models'

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${PRIORITY_STYLE[priority]}`}
      title={PRIORITY_LABEL[priority]}
    >
      <span className="mr-1">{PRIORITY_DOT[priority]}</span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
