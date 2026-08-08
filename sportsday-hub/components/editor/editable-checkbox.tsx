'use client'

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
  return (
    <Checkbox
      checked={item.completed}
      onCheckedChange={() => toggle.mutate(item)}
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
  return (
    <Checkbox
      checked={milestone.completed}
      onCheckedChange={() => toggle.mutate(milestone)}
      disabled={toggle.isPending}
    />
  )
}
