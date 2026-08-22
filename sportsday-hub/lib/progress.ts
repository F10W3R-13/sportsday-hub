import type { Milestone } from '@/lib/types/models'

export interface Progress {
  completed: number
  total: number
  percent: number
}

/**
 * 진행률의 단일 출처.
 * 통합 마일스톤(구 checklist_items 포함)만을 기준으로 계산한다.
 */
export function computeProgress(items: Milestone[]): Progress {
  const total = items.length
  const completed = items.filter((i) => i.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}
