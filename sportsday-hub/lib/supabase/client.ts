import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export interface NicknameGateInput {
  hasNickname: boolean
  promptedThisSession: boolean
  providerReady: boolean
}

// 닉네임 게이트 순수 판정 — provider 준비 + 닉네임 부재 + 세션 내 미프롬프트일 때만 프롬프트.
// SSR은 providerReady=false로 자연 처리된다.
export function shouldPromptNickname(input: NicknameGateInput): boolean {
  return input.providerReady && !input.hasNickname && !input.promptedThisSession
}

const NICKNAME_KEY = 'sportsday-nickname'

// 스토리지 접근 불가 환경(일부 프라이버시 모드)은 null 취급 — 게이트 방어와 정책 일치
export function getNickname(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(NICKNAME_KEY)
  } catch {
    return null
  }
}

export function setNickname(name: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NICKNAME_KEY, name)
  } catch {
    /* no-op */
  }
}

export function hasNickname(): boolean {
  return !!getNickname()
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

declare global {
  interface Window {
    __sportsdayNicknameGateReady?: boolean
  }
}

export const NICKNAME_PROMPT_EVENT = 'nickname:prompt'
const NICKNAME_PROMPTED_KEY = 'sportsday-nickname-prompted'

export interface NicknamePromptDetail {
  resolve: () => void
}

function isProviderReady(): boolean {
  return typeof window !== 'undefined' && window.__sportsdayNicknameGateReady === true
}

// sessionStorage 접근 불가 환경(일부 프라이버시 모드)은 프롬프트 생략 — 마찰 최소 정책
function wasPromptedThisSession(): boolean {
  try {
    return sessionStorage.getItem(NICKNAME_PROMPTED_KEY) === '1'
  } catch {
    return true
  }
}

function markPromptedThisSession(): void {
  try {
    sessionStorage.setItem(NICKNAME_PROMPTED_KEY, '1')
  } catch {
    /* no-op */
  }
}

// 대기 중 중복 호출은 동일 Promise 재사용 (이중 다이얼로그 방지)
let pendingPrompt: Promise<void> | null = null

export function requestNicknameViaProvider(): Promise<void> {
  if (pendingPrompt) return pendingPrompt
  if (!isProviderReady()) return Promise.resolve()
  let settle!: () => void
  const promise = new Promise<void>((resolve) => {
    settle = resolve
  })
  // 할당이 dispatch보다 먼저 오도록 순서를 고정 — 리스너가 동기 resolve하면
  // pendingPrompt=null이 후순 할당에 덮어써 스테일 Promise가 남는 것을 방지
  pendingPrompt = promise
  window.dispatchEvent(
    new CustomEvent<NicknamePromptDetail>(NICKNAME_PROMPT_EVENT, {
      detail: {
        resolve: () => {
          pendingPrompt = null
          settle()
        },
      },
    })
  )
  return promise
}

// 편집 전 호출 — 닉네임 게이트 통과 후 세션 변수 주입해 audit 트리거가 읽음
export async function ensureContext(
  client: ReturnType<typeof createClient>
): Promise<void> {
  if (
    shouldPromptNickname({
      hasNickname: hasNickname(),
      promptedThisSession: wasPromptedThisSession(),
      providerReady: isProviderReady(),
    })
  ) {
    await requestNicknameViaProvider()
    markPromptedThisSession()
  }
  const nickname = getNickname() ?? '익명'
  await client.rpc('set_user_context', { p_nickname: nickname })
}
