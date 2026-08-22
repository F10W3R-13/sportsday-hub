'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { useToggleMilestone } from '@/lib/mutations/milestones'
import type { Milestone } from '@/lib/types/models'

export function EditableTaskCheckbox({
  task,
  label,
}: {
  task: Milestone
  label?: string
}) {
  const toggle = useToggleMilestone()
  const [localChecked, setLocalChecked] = useState(task.completed)

  // task.completed가 외부에서 바뀌면(예: 다른 탭에서 변경) 로컬도 동기화 — 렌더 중 보정 패턴
  const [syncedCompleted, setSyncedCompleted] = useState(task.completed)
  if (syncedCompleted !== task.completed) {
    setSyncedCompleted(task.completed)
    setLocalChecked(task.completed)
  }

  const handleChange = () => {
    setLocalChecked(!localChecked) // 즉시 UI 반영 (낙관적)
    toggle.mutate(task, {
      onError: () => setLocalChecked(task.completed), // 실패 시 원복
    })
  }

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={handleChange}
      disabled={toggle.isPending}
      aria-label={label ?? `${task.title} 완료 여부`}
    />
  )
}
