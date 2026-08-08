'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { useToggleCheck } from '@/lib/mutations/checklist'
import { useToggleMilestone } from '@/lib/mutations/milestones'
import type { ChecklistItem, Milestone } from '@/lib/types/models'

export function EditableChecklistCheckbox({
  item,
}: {
  item: ChecklistItem
}) {
  const toggle = useToggleCheck()
  const [localChecked, setLocalChecked] = useState(item.completed)

  const handleChange = () => {
    setLocalChecked(!localChecked) // 즉시 UI 반영
    toggle.mutate(item)            // 백그라운드에서 DB 저장
  }

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
    />
  )
}

export function EditableMilestoneCheckbox({
  milestone,
}: {
  milestone: Milestone
}) {
  const toggle = useToggleMilestone()
  const [localChecked, setLocalChecked] = useState(milestone.completed)

  const handleChange = () => {
    setLocalChecked(!localChecked)
    toggle.mutate(milestone)
  }

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
    />
  )
}
