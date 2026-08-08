'use client'

import { useState } from 'react'
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
  const [localStatus, setLocalStatus] = useState<DecisionStatus>(decision.status)

  const handleChange = (value: DecisionStatus | null) => {
    if (!value) return
    setLocalStatus(value) // 즉시 UI 반영
    update.mutate({ id: decision.id, status: value }) // 백그라운드 저장
  }

  return (
    <Select value={localStatus} onValueChange={handleChange}>
      <SelectTrigger className="w-28">
        <SelectValue>
          {(value: DecisionStatus) => DECISION_STATUS_LABEL[value]}
        </SelectValue>
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
