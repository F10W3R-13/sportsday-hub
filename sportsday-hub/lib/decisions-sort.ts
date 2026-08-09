import type { Decision } from '@/lib/types/models'

/**
 * 결정 항목을 미확정 우선으로 정렬한다.
 * - 미확정(discussing/pending/deferred): sort_order 오름차순으로 상단
 * - 확정(confirmed): sort_order 오름차순으로 하단
 * sort_order 자체는 변경하지 않는다(읽기 전용 정렬).
 */
export function sortDecisions(decisions: Decision[]): Decision[] {
  return [...decisions].sort((a, b) => {
    const aConfirmed = a.status === 'confirmed' ? 1 : 0
    const bConfirmed = b.status === 'confirmed' ? 1 : 0
    if (aConfirmed !== bConfirmed) return aConfirmed - bConfirmed
    return a.sort_order - b.sort_order
  })
}
