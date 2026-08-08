import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveDriveTokens } from '@/lib/drive/client'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=oauth_denied', baseUrl))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings?error=no_refresh_token', baseUrl))
    }

    // 이메일 조회
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URL
    )
    oauth2Client.setCredentials(tokens)
    const userInfo = await oauth2Client.getTokenInfo(tokens.access_token)
    const email = userInfo.email ?? 'unknown'

    await saveDriveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
      email,
    })

    return NextResponse.redirect(new URL('/settings?connected=true', baseUrl))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=callback_failed', baseUrl))
  }
}
