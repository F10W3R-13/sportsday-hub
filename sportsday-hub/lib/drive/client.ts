import { google } from 'googleapis'
import { encryptToken, decryptToken } from './crypto'
import { createServiceClient } from '@/lib/supabase/service'

// 토큰 조회 (복호화)
export async function getDriveTokens(): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
  email: string | null
} | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('drive_tokens')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (!data || !data.access_token || !data.refresh_token) return null

  return {
    accessToken: decryptToken(data.access_token),
    refreshToken: decryptToken(data.refresh_token),
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    email: data.email,
  }
}

// 토큰 저장 (암호화)
export async function saveDriveTokens(params: {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  email: string
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('drive_tokens').upsert({
    id: 1,
    email: params.email,
    access_token: encryptToken(params.accessToken),
    refresh_token: encryptToken(params.refreshToken),
    expires_at: params.expiresAt.toISOString(),
  })
}

// 토큰 삭제
export async function clearDriveTokens(): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('drive_tokens').delete().eq('id', 1)
}

// 토큰으로 Google Drive 클라이언트 생성 (만료 시 자동 갱신)
export async function createDriveClient(): Promise<{
  drive: ReturnType<typeof google.drive>
  email: string | null
} | null> {
  const tokens = await getDriveTokens()
  if (!tokens) return null

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt?.getTime(),
  })

  // 만료 시 자동 갱신 이벤트 처리
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      // 새 refresh_token이 오면 저장
      const accessToken = newTokens.access_token ?? tokens.accessToken
      const refreshToken = newTokens.refresh_token ?? tokens.refreshToken
      const expiresAt = newTokens.expiry_date
        ? new Date(newTokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000)
      await saveDriveTokens({
        accessToken,
        refreshToken,
        expiresAt,
        email: tokens.email ?? '',
      })
    }
  })

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  return { drive, email: tokens.email }
}

// OAuth 인증 URL 생성
export function getAuthUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
    prompt: 'consent', // refresh_token을 받기 위해 강제 동의
  })
}

// 인증 코드를 토큰으로 교환
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URL
  )

  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}
