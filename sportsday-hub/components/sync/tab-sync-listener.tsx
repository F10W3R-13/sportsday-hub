'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { onTabSync } from '@/lib/sync'
import { queryKeys } from '@/lib/queries/keys'

/**
 * 다른 탭에서 발생한 체크리스트/마일스톤 변경을 수신하여
 * 현재 탭의 캐시와 서버 데이터를 갱신한다.
 * Providers 아래에 마운트하여 모든 페이지에 적용.
 */
export function TabSyncListener() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    return onTabSync((msg) => {
      if (msg.type === 'checklist-updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.checklist })
        void router.refresh()
      }
      if (msg.type === 'milestone-updated') {
        queryClient.invalidateQueries({ queryKey: queryKeys.milestones })
        void router.refresh()
      }
    })
  }, [queryClient, router])

  return null
}
