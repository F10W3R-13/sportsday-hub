import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMemoViaEnv } from '@/lib/kakao-memo'
import { kstTodayDate, buildBotAlert, isBotEnded } from '@/lib/kakao-bot'

/**
 * 데드맨 스위치 — 18:10 KST에 오늘 봇 보고(bot_runs)가 없으면 미실행 경보.
 * 서버 측 크론이라 PC가 꺼져 있어도 항상 실행된다.
 * 봇 종료 시점(행사일 2026-09-20 18:00 KST) 이후에는 경보 없이 조용히 종료.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    if (isBotEnded()) {
      return NextResponse.json({ ok: true, ended: true })
    }

    // service_role 필요: 0020 마이그레이션이 bot_runs을 RLS 정책 0개(서버 전용)로 둠
    const supabase = createServiceClient()
    const { data: runs, error } = await supabase
      .from('bot_runs')
      .select('id')
      .eq('run_date', kstTodayDate())
      .limit(1)
    if (error) throw new Error(error.message)

    if (runs && runs.length > 0) {
      return NextResponse.json({ ok: true, reported: true })
    }

    const result = await sendMemoViaEnv(buildBotAlert('watchdog', null))
    if (!result.sent && result.error) throw new Error(result.error)
    return NextResponse.json({ ok: true, reported: false, alerted: !result.dryRun })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
