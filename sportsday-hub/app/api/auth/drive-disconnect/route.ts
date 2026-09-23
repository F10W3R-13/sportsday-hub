import { NextResponse } from 'next/server'
import { clearDriveTokens } from '@/lib/drive/client'

/**
 * 구글 드라이브 연동 해제 — drive_tokens 싱글턴 행 삭제.
 * 앱은 토큰 행이 없으면 "미연결" 상태로 전환된다.
 * Google 측 권한 철회는 사용자가 Google 계정 관리에서 별도로 해야 완전한 해제다.
 */
export async function POST() {
  try {
    await clearDriveTokens()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '해제 실패' },
      { status: 500 }
    )
  }
}
