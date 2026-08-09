import type { ChecklistItem } from '@/lib/types/models'

export interface Progress {
  completed: number
  total: number
  percent: number
}

/**
 * 진행률의 단일 출처.
 * checklist_items만을 기준으로 계산한다.
 * 마일스톤 자체의 completed는 별개 표시지, 진행률에 포함하지 않는다.
 */
export function computeProgress(items: ChecklistItem[]): Progress {
  const total = items.length
  const completed = items.filter((i) => i.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}
