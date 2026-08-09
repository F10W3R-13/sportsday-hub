'use client'

import { useState, useEffect } from 'react'
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

  // item.completed가 외부에서 바뀌면(예: 다른 탭에서 변경) 로컬도 동기화
  useEffect(() => {
    setLocalChecked(item.completed)
  }, [item.completed])

  const handleChange = () => {
    setLocalChecked(!localChecked) // 즉시 UI 반영 (낙관적)
    toggle.mutate(item, {
      onError: () => setLocalChecked(item.completed), // 실패 시 원복
    })
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

  useEffect(() => {
    setLocalChecked(milestone.completed)
  }, [milestone.completed])

  const handleChange = () => {
    setLocalChecked(!localChecked)
    toggle.mutate(milestone, {
      onError: () => setLocalChecked(milestone.completed),
    })
  }

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
    />
  )
}
