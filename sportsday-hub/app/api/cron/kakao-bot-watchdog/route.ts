import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import { sendMemoViaEnv } from '@/lib/kakao-memo'
import { kstTodayDate, buildBotAlert } from '@/lib/kakao-bot'

/**
 * 데드맨 스위치 — 18:10 KST에 오늘 봇 보고(bot_runs)가 없으면 미실행 경보.
 * 서버 측 크론이라 PC가 꺼져 있어도 항상 실행된다.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const { data: runs, error } = await supabase
      .from('bot_runs')
      .select('id')
      .eq('run_date', kstTodayDate())
      .limit(1)
    if (error) throw new Error(error.message)

    if (runs && runs.length > 0) {
      return NextResponse.json({ ok: true, reported: true })
    }

    // 미보고: 경보 발송 (다이제스트 조회에 실패해도 경보는 간다)
    let digestText: string | null = null
    try {
      const [{ data: milestones }, { data: handoffs }, { data: teams }] = await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*'),
      ])
      digestText = buildKakaoDigest(
        { tasks: milestones ?? [], handoffs: handoffs ?? [], teams: teams ?? [] },
        { style: 'detailed', maxItems: 20, textLimit: 2000 }
      ).text
    } catch {
      digestText = null
    }

    const result = await sendMemoViaEnv(buildBotAlert('watchdog', null, digestText))
    if (!result.sent && result.error) throw new Error(result.error)
    return NextResponse.json({ ok: true, reported: false, alerted: !result.dryRun })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
