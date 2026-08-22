import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * service_role 클라이언트 (RLS 우회, 서버 전용).
 * anon 롤로는 접근할 수 없는 테이블(bot_runs 등 RLS 정책 0개)의
 * 서버 내부 읽기/쓰기에 사용한다. 절대 클라이언트 컴포넌트로 노출 금지.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
