import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/drive/client'

export async function GET() {
  try {
    const url = getAuthUrl()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('OAuth connect error:', error)
    return NextResponse.redirect(
      new URL('/settings?error=oauth_failed', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000')
    )
  }
}
