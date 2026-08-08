'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useUpdateDecision } from '@/lib/mutations/decisions'
import {
  DECISION_STATUS_LABEL,
  type DecisionStatus,
  type Decision,
} from '@/lib/types/models'

const STATUSES: DecisionStatus[] = [
  'confirmed',
  'discussing',
  'pending',
  'deferred',
]

export function DecisionStatusSelect({ decision }: { decision: Decision }) {
  const update = useUpdateDecision()

  return (
    <Select
      value={decision.status}
      onValueChange={(value) =>
        update.mutate({
          id: decision.id,
          status: value as DecisionStatus,
        })
      }
    >
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {DECISION_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
