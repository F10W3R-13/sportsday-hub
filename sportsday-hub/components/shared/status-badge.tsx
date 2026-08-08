import { Badge } from '@/components/ui/badge'
import {
  DECISION_STATUS_LABEL,
  type DecisionStatus,
} from '@/lib/types/models'

const STATUS_STYLE: Record<DecisionStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  discussing: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  pending: 'bg-gray-100 text-gray-600 border-gray-300',
  deferred: 'bg-blue-100 text-blue-700 border-blue-300',
}

const STATUS_ICON: Record<DecisionStatus, string> = {
  confirmed: '🟢',
  discussing: '🟡',
  pending: '⚪',
  deferred: '⚪',
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      <span className="mr-1">{STATUS_ICON[status]}</span>
      {DECISION_STATUS_LABEL[status]}
    </Badge>
  )
}
