'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { NicknameDialog } from './nickname-dialog'
import {
  NICKNAME_PROMPT_EVENT,
  type NicknamePromptDetail,
} from '@/lib/supabase/client'

export function NicknameProvider({ children }: { children: React.ReactNode }) {
  const [showDialog, setShowDialog] = useState(false)
  const resolveRef = useRef<(() => void) | null>(null)

  // 게이트(lib/supabase/client.ts)가 발행하는 이벤트 수신.
  // setState는 이벤트 콜백 안에서 호출 — React Compiler의 set-state-in-effect
  // 규칙 대상이 아니다(이펙트 본문 아님).
  useEffect(() => {
    const handlePrompt = (e: Event) => {
      const detail = (e as CustomEvent<NicknamePromptDetail>).detail
      resolveRef.current = detail.resolve
      setShowDialog(true)
    }
    window.addEventListener(NICKNAME_PROMPT_EVENT, handlePrompt)
    window.__sportsdayNicknameGateReady = true
    return () => {
      window.__sportsdayNicknameGateReady = false
      window.removeEventListener(NICKNAME_PROMPT_EVENT, handlePrompt)
    }
  }, [])

  // 닫기는 설정·건너뛰기·Escape 모두 동일 취급 — 대기 중인 편집을 해소한다
  const handleClose = useCallback(() => {
    setShowDialog(false)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.()
  }, [])

  return (
    <>
      {children}
      <NicknameDialog open={showDialog} onClose={handleClose} />
    </>
  )
}
