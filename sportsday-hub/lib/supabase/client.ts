import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

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
  // Database 타입에 Functions를 정의했으나 postgrest-js의 rpc()는
  // 수동 Database 타입에서 Args 타입 추론이 동작하지 않아 캐스트 필요.
  await client.rpc(
    'set_user_context',
    { p_nickname: nickname } as never
  )
}
