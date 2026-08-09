import type { ChecklistItem, Milestone } from '@/lib/types/models'

/**
 * 마일스톤 자동 완료 판정.
 *
 * 규칙: 마일스톤에 하위 체크리스트가 있고, 그 체크리스트가 전부 완료면
 * 마일스톤 completed를 true로 자동 동기화한다.
 * 하위 체크리스트가 없는 마일스톤(순수 마일스톤)은 자동 완료 대상이 아니다 —
 * 사용자가 직접 토글한다.
 *
 * 이 함수는 "판정만" 한다. DB 갱신은 mutation에서 담당.
 */

/**
 * 특정 마일스톤이 자동 완료되어야 하는지 판정한다.
 * - 하위 항목이 없거나 0개 → false (자동 완료 대상 아님)
 * - 하위 항목이 1개 이상이고 전부 완료 → true
 * - 그 외 → false
 */
export function shouldCompleteMilestone(
  milestone: Milestone,
  checklist: ChecklistItem[]
): boolean {
  const items = checklist.filter((c) => c.milestone_id === milestone.id)
  if (items.length === 0) return false
  return items.every((c) => c.completed)
}

/**
 * 체크리스트 상태를 바탕으로, 자동 완료되어야 하는 마일스톤 ID 목록을 반환한다.
 * 이미 completed인 마일스톤은 제외한다(변경이 필요 없으므로).
 *
 * 전체 마일스톤 + 전체 체크리스트를 받아 "completed=false → true로 바뀌어야 할"
 * 마일스톤만 걸러낸다.
 */
export function findMilestonesToComplete(
  milestones: Milestone[],
  checklist: ChecklistItem[]
): Milestone[] {
  return milestones.filter(
    (m) =>
      !m.completed &&
      m.id &&
      shouldCompleteMilestone(m, checklist)
  )
}

/**
 * 체크리스트 상태를 바탕으로, 자동 미완료(rollback)되어야 하는 마일스톤 목록을 반환한다.
 * 이미 completed인 마일스톤 중, 하위 체크리스트가 있고 하나라도 미완료가 있으면
 * completed를 false로 되돌린다.
 *
 * 하위 체크리스트가 없는 마일스톤(사용자가 직접 토글한 순수 마일스톤)은 롤백 대상이 아니다.
 */
export function findMilestonesToReopen(
  milestones: Milestone[],
  checklist: ChecklistItem[]
): Milestone[] {
  return milestones.filter((m) => {
    if (!m.completed) return false
    const items = checklist.filter((c) => c.milestone_id === m.id)
    if (items.length === 0) return false // 순수 마일스톤 — 건드리지 않음
    return items.some((c) => !c.completed)
  })
}
