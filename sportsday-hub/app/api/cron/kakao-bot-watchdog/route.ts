import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
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

    // 미보고: 경보 발송 (다이제스트 조회에 실패해도 경보는 간다)
    let digestText: string | null = null
    try {
      const [milestones, handoffs, teams] = await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*'),
      ])
      // supabase select는 실패 시 throw하지 않고 error 필드를 반환 → 조회 실패로 폴백
      const firstError = milestones.error ?? handoffs.error ?? teams.error
      if (firstError) throw new Error(firstError.message)
      digestText = buildKakaoDigest(
        { tasks: milestones.data ?? [], handoffs: handoffs.data ?? [], teams: teams.data ?? [] },
        { style: 'compact', textLimit: 100 }
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
