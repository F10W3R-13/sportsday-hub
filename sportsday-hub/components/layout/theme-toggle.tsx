'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'theme'

/** html.dark 클래스 변경을 구독 — 토글이 DOM을 직접 바꾸면 이 컴포넌트가 자동 반영 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

/**
 * 라이트/다크 토글 — html.dark 클래스 + localStorage('theme') 저장.
 * 초기 클래스는 layout.tsx의 인라인 스크립트가 깜빡임 없이 먼저 적용한다.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    useCallback(() => document.documentElement.classList.contains('dark'), []),
    () => false
  )

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // 스토리지 접근 불가 환경에서는 세션 내 클래스 토글만 유지
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {dark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  )
}
