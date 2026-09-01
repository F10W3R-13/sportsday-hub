import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'

/**
 * PC 자동화 스크립트(kakao_group_sender.py)가 오늘의 다이제스트 텍스트를
 * 가져가는 엔드포인트. 단체방 전송은 길이 제한이 없으므로
 * 잘라내지 않는 detailed 스타일로 넉넉하게 만든다.
 * - 임박 항목이 없으면 "오늘 마감 없음 + 다음 마감" 안내를 반환한다 (매일 일정 도착).
 * - CRON_SECRET이 설정돼 있으면 Bearer 인증 필요
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    const digest = buildKakaoDigest(
      {
        tasks: milestones ?? [],
        handoffs: handoffs ?? [],
        teams: teams ?? [],
      },
      { style: 'detailed', maxItems: 100, textLimit: 2000 } // 전체 노출(2026-09-01 확정) — 2000자는 이상 시 안전판
    )

    // 임박 항목이 없어도 안내 텍스트를 반환한다 (매일 일정 도착 = 봇 생존 확인).
    return NextResponse.json({ text: digest.text, total: digest.total })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
