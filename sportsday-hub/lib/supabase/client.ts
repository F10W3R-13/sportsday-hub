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

export function getNickname(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NICKNAME_KEY)
}

export function setNickname(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NICKNAME_KEY, name)
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

// 편집 전 호출 — 닉네임을 세션 변수로 주입해 audit 트리거가 읽음
export async function ensureContext(
  client: ReturnType<typeof createClient>
): Promise<void> {
  const nickname = getNickname() ?? '익명'
  await client.rpc('set_user_context', { p_nickname: nickname })
}
