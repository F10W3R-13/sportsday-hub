'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { shouldRefreshAfterSync } from '@/lib/file-feed'

// 페이지 진입 시 백그라운드 동기화 — 렌더를 블로킹하지 않는다 (스펙 §3).
// 신선도(5분) 스킵이면 무연산, 실제 동기화가 수행됐을 때만 화면을 갱신한다.
export function DriveSyncTrigger() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/drive/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (shouldRefreshAfterSync(data)) router.refresh()
      })
      .catch(() => {
        // 백그라운드 트리거 실패는 UI 없음 — "마지막 동기화" 표시가 상태를 설명 (스펙 §7)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
