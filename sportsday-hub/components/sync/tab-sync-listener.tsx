'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { onTabSync } from '@/lib/sync'
import { queryKeys } from '@/lib/queries/keys'

/**
 * 다른 탭에서 발생한 작업(마일스톤/체크리스트 통합 엔터티) 변경을 수신하여
 * 현재 탭의 캐시와 서버 데이터를 갱신한다.
 * Providers 아래에 마운트하여 모든 페이지에 적용.
 */
export function TabSyncListener() {
  const queryClient = useQueryClient()
  const router = useRouter()

  // queryClient와 router는 앱 전역 싱글톤 — 재구독 불필요. 마운트 시 1회만 구독.
  useEffect(() => {
    return onTabSync((msg) => {
      if (msg.type === 'tasks-updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
        void router.refresh()
      }
      if (msg.type === 'decision-updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.decisions })
        void router.refresh()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
