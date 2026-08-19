import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildKakaoDigest } from '@/lib/kakao-digest'

/**
 * 매일 아침 임박 마일스톤·인계를 총괄 카카오톡('나에게 보내기')으로 발송하는 크론 엔드포인트.
 * - 임박 항목이 없으면 발송하지 않는다.
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
      milestones: milestones ?? [],
      handoffs: handoffs ?? [],
      teams: teams ?? [],
    })
    if (!digest) {
      return NextResponse.json({ sent: false, reason: 'no_urgent_items' })
    }

    const clientId = process.env.KAKAO_CLIENT_ID
    const refreshToken = process.env.KAKAO_REFRESH_TOKEN
    if (!clientId || !refreshToken) {
      return NextResponse.json({ sent: false, dryRun: true, text: digest.text, total: digest.total })
    }

    const accessToken = await refreshKakaoToken(clientId, refreshToken)
    await sendKakaoMemo(accessToken, digest.text)

    return NextResponse.json({ sent: true, total: digest.total, text: digest.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** 리프레시 토큰으로 액세스 토큰 발급. 매일 실행되므로 리프레시 토큰도 함께 연장된다. */
async function refreshKakaoToken(clientId: string, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken })
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    throw new Error(`kakao token refresh 실패 (${res.status}): ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

/** 카카오톡 '나에게 보내기' — 텍스트 템플릿. */
async function sendKakaoMemo(accessToken: string, text: string): Promise<void> {
  const template = {
    object_type: 'text' as const,
    text,
    link: { web_url: 'https://sportsday-hub.vercel.app' },
  }
  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  })
  if (!res.ok) {
    throw new Error(`kakao memo send 실패 (${res.status}): ${await res.text()}`)
  }
}
