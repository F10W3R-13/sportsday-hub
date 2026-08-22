/** 카카오톡 '나에게 보내기' 공통 모듈 — 크론·봇 보고·watchdog이 공유. */

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

/** env 기반 메모 발송. 토큰 미설정 시 dry-run(발송 생략). */
export async function sendMemoViaEnv(text: string): Promise<{ sent: boolean; dryRun?: boolean; error?: string }> {
  const clientId = process.env.KAKAO_CLIENT_ID
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN
  if (!clientId || !refreshToken) return { sent: false, dryRun: true }
  try {
    const accessToken = await refreshKakaoToken(clientId, refreshToken)
    await sendKakaoMemo(accessToken, text)
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) }
  }
}
