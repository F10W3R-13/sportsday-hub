import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    const supabase = await createClient()
    const { error: insertError } = await supabase
      .from('bot_runs')
      .insert({ run_date: kstTodayDate(), status: body.status, detail: body.detail ?? null })
    if (insertError) throw new Error(insertError.message)

    // 실패 보고는 즉시 경보 — 다이제스트를 새로 만들어 수동 폴백 텍스트로 포함
    if (body.status === 'fail') {
      const [{ data: milestones }, { data: handoffs }, { data: teams }] = await Promise.all([
        supabase.from('milestones').select('*').is('deleted_at', null),
        supabase.from('handoffs').select('*').is('deleted_at', null),
        supabase.from('teams').select('*'),
      ])
      const digest = buildKakaoDigest(
        { tasks: milestones ?? [], handoffs: handoffs ?? [], teams: teams ?? [] },
        { style: 'detailed', maxItems: 20, textLimit: 2000 }
      )
      const alert = buildBotAlert('fail', body.detail ?? null, digest.text)
      const result = await sendMemoViaEnv(alert)
      return NextResponse.json({ recorded: true, alerted: result.sent, alertError: result.error ?? null })
    }

    return NextResponse.json({ recorded: true, alerted: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
