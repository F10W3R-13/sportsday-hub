import { NextRequest, NextResponse } from 'next/server'
import { discoverTeamFolders, syncDriveFiles, createServiceClient } from '@/lib/drive/sync'
import type { TeamId } from '@/lib/types/models'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { parentFolderUrl } = body

    // URL에서 폴더 ID 추출
    const match = (parentFolderUrl as string)?.match(/folders\/([a-zA-Z0-9_-]+)/)
    if (!match) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    }
    const parentFolderId = match[1]

    // 하위 폴더 탐색 및 팀별 매핑
    const { mapping, allFolders } = await discoverTeamFolders(parentFolderId)

    // 매핑 결과를 teams 테이블에 저장
    const supabase = createServiceClient()
    for (const [teamId, folderId] of Object.entries(mapping)) {
      if (folderId) {
        await supabase
          .from('teams')
          .update({ drive_folder_id: folderId })
          .eq('id', teamId as TeamId)
      }
    }

    // 동기화 트리거
    const syncResult = await syncDriveFiles(undefined, true)

    return NextResponse.json({
      mapping,
      allFolders,
      sync: syncResult,
    })
  } catch (err) {
    console.error('Auto-map error:', err)
    return NextResponse.json({ error: 'auto_map_failed' }, { status: 500 })
  }
}
