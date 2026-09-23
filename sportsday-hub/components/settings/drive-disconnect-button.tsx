'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 드라이브 연동 해제 버튼 — 클릭 시 POST /api/auth/drive-disconnect 호출 후
 * 페이지 새로고침으로 연결 상태 UI 갱신.
 */
export function DriveDisconnectButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const handleDisconnect = async () => {
    if (!confirm('구글 드라이브 연동을 해제할까요?\n파일 피드·팀 폴더 매핑이 즉시 중단됩니다.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/drive-disconnect', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        alert(`해제 실패: ${body?.error ?? res.statusText}`)
      }
    } catch {
      alert('해제 요청 실패 — 네트워크 상태 확인')
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={busy}
      className="inline-block rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? '해제 중…' : '연결 해제'}
    </button>
  )
}
