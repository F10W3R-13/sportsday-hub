'use client'

import { createClient, ensureContext } from '@/lib/supabase/client'
import {
  findMilestonesToComplete,
  findMilestonesToReopen,
} from '@/lib/milestone-completion'
import type { ChecklistItem, Milestone } from '@/lib/types/models'

/**
 * 체크리스트 변경 후 마일스톤 completed를 자동 동기화한다.
 *
 * 서버에서 최신 체크리스트 + 마일스톤을 재조회하여:
 * 1. 하위 체크리스트가 전부 완료된 미완료 마일스톤 → completed = true
 * 2. 완료된 마일스톤 중 하위가 하나라도 미완료 → completed = false (롤백)
 *
 * 하위 체크리스트가 없는 순수 마일스톤은 건드리지 않는다 (사용자 직접 토글).
 * router.refresh()가 대시보드 서버 컴포넌트를 재실행하므로 갱신된 마일스톤이
 * 반영된다.
 *
 * 에러는 삼킨다(swallow) — 마일스톤 동기화 실패가 체크 토글 자체를 실패시키면 안 됨.
 * 단, 조용히 무시하면 디버깅이 막히므로 console.error로 기록은 남긴다 (회고 2026-08-12 반영).
 * (체크는 이미 DB에 저장됨)
 */
export async function syncMilestoneCompletion(): Promise<void> {
  try {
    const client = createClient()
    await ensureContext(client)

    // 최신 체크리스트 + 마일스톤 조회
    const [{ data: checklist }, { data: milestones }] = await Promise.all([
      client
        .from('checklist_items')
        .select('*')
        .is('deleted_at', null),
      client
        .from('milestones')
        .select('*')
        .is('deleted_at', null),
    ])

    if (!checklist || !milestones) return

    const toComplete = findMilestonesToComplete(
      milestones as Milestone[],
      checklist as ChecklistItem[]
    )
    const toReopen = findMilestonesToReopen(
      milestones as Milestone[],
      checklist as ChecklistItem[]
    )

    // 완료 처리
    for (const m of toComplete) {
      await client
        .from('milestones')
        .update({ completed: true })
        .eq('id', m.id)
    }

    // 롤백 처리
    for (const m of toReopen) {
      await client
        .from('milestones')
        .update({ completed: false })
        .eq('id', m.id)
    }
  } catch (err) {
    // 삼킴(throw 안 함): 체크 토글은 성공했으므로 동기화 실패를 토글 실패로 만들지 않음.
    // 단, 로깅하지 않으면 "체크했는데 마일스톤이 안 닫혔다"를 디버깅하기 어렵다.
    console.error('[milestone-sync] 체크리스트 동기화 실패:', err)
  }
}
