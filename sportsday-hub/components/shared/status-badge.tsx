import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  CircleDashed,
  MessagesSquare,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react'
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

// 이모지 대신 아웃라인 아이콘 — pending/deferred가 아이콘만으로도 구분되도록
const STATUS_ICON: Record<DecisionStatus, LucideIcon> = {
  confirmed: CheckCircle2,
  discussing: MessagesSquare,
  pending: CircleDashed,
  deferred: PauseCircle,
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      <Icon className="mr-1 size-3" aria-hidden />
      {DECISION_STATUS_LABEL[status]}
    </Badge>
  )
}
