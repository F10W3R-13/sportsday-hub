import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveDriveTokens } from '@/lib/drive/client'
import { discoverTeamFolders, syncDriveFiles, createServiceClient } from '@/lib/drive/sync'
import { google } from 'googleapis'
import type { TeamId } from '@/lib/types/models'

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

    // 이메일 조회 — userinfo API로 직접 호출
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URL
    )
    oauth2Client.setCredentials(tokens)
    let email = 'unknown'
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (res.ok) {
        const userInfo = await res.json()
        email = userInfo.email ?? 'unknown'
      }
    } catch {
      // 이메일 조회 실패는 연결 자체를 실패시키지 않음
    }

    // 토큰 저장
    await saveDriveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
      email,
    })

    // === 자동 매핑 + 동기화 ===
    // 환경 변수 DRIVE_ROOT_FOLDER_ID에 상위 폴더 ID가 있으면
    // 토큰 저장 직후 자동으로 하위 폴더 매핑 + 파일 동기화 실행
    const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID
    if (rootFolderId) {
      try {
        const { mapping } = await discoverTeamFolders(rootFolderId)

        // 매핑 결과를 teams 테이블에 저장
        const supabase = createServiceClient()

        // management는 상위 폴더 자체에 매핑 (하위 팀 폴더가 아닌 직접 파일용)
        mapping.management = rootFolderId

        for (const [teamId, folderId] of Object.entries(mapping)) {
          if (folderId) {
            await supabase
              .from('teams')
              .update({ drive_folder_id: folderId })
              .eq('id', teamId as TeamId)
          }
        }

        // 즉시 동기화
        await syncDriveFiles(undefined, true)
      } catch (syncErr) {
        // 동기화 실패는 OAuth 연결 자체를 실패시키지 않음
        // 사용자는 연결 후 수동으로 재시도 가능
        console.error('Auto-sync after connect failed:', syncErr)
      }
    }

    return NextResponse.redirect(new URL('/settings?connected=true', baseUrl))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=callback_failed', baseUrl))
  }
}
