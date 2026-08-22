import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildKakaoDigest } from '@/lib/kakao-digest'
import { sendMemoViaEnv } from '@/lib/kakao-memo'
import { kstTodayDate, buildBotAlert } from '@/lib/kakao-bot'

/**
 * PC 스크립트(kakao_group_sender.py)가 종료 전 호출하는 실행 보고 엔드포인트.
 * - success: bot_runs에 기록만 (조용히)
 * - fail: 기록 + 즉시 '나에게 보내기' 경보 발송(수동 폴백용 다이제스트 포함)
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { status?: string; detail?: string }
    if (body.status !== 'success' && body.status !== 'fail') {
      return NextResponse.json({ error: 'status must be success|fail' }, { status: 400 })
    }

    // service_role 필요: 0020 마이그레이션이 bot_runs을 RLS 정책 0개(서버 전용)로 둠
    const supabase = createServiceClient()
    const { error: insertError } = await supabase
      .from('bot_runs')
      .insert({ run_date: kstTodayDate(), status: body.status, detail: body.detail ?? null })
    if (insertError) throw new Error(insertError.message)

    // 실패 보고는 즉시 경보 — 다이제스트를 새로 만들어 수동 폴백 텍스트로 포함.
    // 조회 실패 시에도 경보 자체는 링크 안내 형태로 발송된다.
    if (body.status === 'fail') {
      let digestText: string | null = null
      try {
        const [milestones, handoffs, teams] = await Promise.all([
          supabase.from('milestones').select('*').is('deleted_at', null),
          supabase.from('handoffs').select('*').is('deleted_at', null),
          supabase.from('teams').select('*'),
        ])
        const firstError = milestones.error ?? handoffs.error ?? teams.error
        if (firstError) throw new Error(firstError.message)
        digestText = buildKakaoDigest(
          { tasks: milestones.data ?? [], handoffs: handoffs.data ?? [], teams: teams.data ?? [] },
          { style: 'compact', textLimit: 100 }
        ).text
      } catch {
        digestText = null
      }
      const alert = buildBotAlert('fail', body.detail ?? null, digestText)
      const result = await sendMemoViaEnv(alert)
      return NextResponse.json({ recorded: true, alerted: result.sent, alertError: result.error ?? null })
    }

    return NextResponse.json({ recorded: true, alerted: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
