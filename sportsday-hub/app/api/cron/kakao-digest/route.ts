import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import { sendMemoViaEnv } from '@/lib/kakao-memo'

/**
 * 매일 아침 임박 마일스톤·인계를 총괄 카카오톡('나에게 보내기')으로 발송하는 크론 엔드포인트.
 * - 임박 항목이 없으면 "오늘 마감 없음 + 다음 마감" 안내를 발송한다 (매일 일정 도착).
 * - KAKAO_CLIENT_ID/KAKAO_REFRESH_TOKEN이 없으면 dry-run(미리보기만 반환) — 배포 전 검증용.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Vercel 크론은 CRON_SECRET이 설정돼 있으면 Bearer로 실어 보낸다. 로컬은 통과.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const [{ data: milestones }, { data: handoffs }, { data: teams }] = await Promise.all([
      supabase.from('milestones').select('*').is('deleted_at', null),
      supabase.from('handoffs').select('*').is('deleted_at', null),
      supabase.from('teams').select('*').is('deleted_at', null),
    ])

    const digest = buildKakaoDigest({
      tasks: milestones ?? [],
      handoffs: handoffs ?? [],
      teams: teams ?? [],
    })
    // 임박 항목이 없어도 "오늘 마감 없음 + 다음 마감" 안내를 발송한다 (매일 일정 도착 = 봇 생존 확인).

    const result = await sendMemoViaEnv(digest.text)
    if (!result.sent && result.error) throw new Error(result.error)
    if (!result.sent && result.dryRun) {
      return NextResponse.json({ sent: false, dryRun: true, text: digest.text, total: digest.total })
    }
    return NextResponse.json({ sent: true, total: digest.total, text: digest.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
