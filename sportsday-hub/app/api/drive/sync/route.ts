import { NextRequest, NextResponse } from 'next/server'
import { syncDriveFiles } from '@/lib/drive/sync'
import type { TeamId } from '@/lib/types/models'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const teamId = body.teamId as TeamId | undefined
    const force = body.force === true

    const result = await syncDriveFiles(teamId, force)

    if (!result.success && result.error === 'not_connected') {
      return NextResponse.json({ error: 'drive_not_connected' }, { status: 401 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
