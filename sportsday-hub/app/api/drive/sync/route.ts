import { NextRequest, NextResponse } from 'next/server'
import { syncDriveFiles, createServiceClient } from '@/lib/drive/sync'
import type { TeamId } from '@/lib/types/models'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    // 폴더 매핑 저장 액션: 팀 drive_folder_id 업데이트 후 즉시 동기화
    if (body.action === 'save_folders' && Array.isArray(body.updates)) {
      const supabase = createServiceClient()
      for (const update of body.updates) {
        await supabase
          .from('teams')
          .update({ drive_folder_id: update.drive_folder_id })
          .eq('id', update.id)
      }
      // 저장 후 즉시 동기화
      const result = await syncDriveFiles(undefined, true)
      return NextResponse.json({ saved: true, ...result })
    }

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
