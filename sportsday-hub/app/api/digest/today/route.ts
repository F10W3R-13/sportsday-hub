import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'

/**
 * PC 자동화 스크립트(kakao_group_sender.py)가 오늘의 다이제스트 텍스트를
 * 가져가는 엔드포인트. 단체방 전송은 길이 제한이 없으므로
 * 잘라내지 않는 detailed 스타일로 넉넉하게 만든다.
 * - 임박 항목이 없으면 text: null 반환 (스크립트는 이 경우 전송하지 않음)
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
    const [{ data: milestones }, { data: handoffs }, { data: teams }, { data: checklistItems }] =
      await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*').is('deleted_at', null),
        supabase.from('checklist_items').select('*').eq('completed', false).is('deleted_at', null),
      ])

    const digest = buildKakaoDigest(
      {
        milestones: milestones ?? [],
        handoffs: handoffs ?? [],
        teams: teams ?? [],
        checklistItems: checklistItems ?? [],
      },
      { style: 'detailed', maxItems: 20, textLimit: 2000 }
    )

    if (!digest) {
      return NextResponse.json({ text: null, total: 0 })
    }
    return NextResponse.json({ text: digest.text, total: digest.total })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
