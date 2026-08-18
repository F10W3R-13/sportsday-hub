import { FileFeedClient } from '@/components/drive/file-feed-client'
import { getRecentDriveFiles, getLastSyncedAt } from '@/lib/queries/drive-files'
import { getTeams } from '@/lib/queries/teams'
import { getDriveConnectionStatus } from '@/lib/drive/sync'

export default async function FilesPage() {
  const [files, teams, lastSyncedAt, status] = await Promise.all([
    getRecentDriveFiles(100),
    getTeams(),
    getLastSyncedAt(),
    getDriveConnectionStatus(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">파일 피드</h1>
        <p className="text-sm text-muted-foreground">
          전체 팀 드라이브 파일 · 최근 수정순
        </p>
      </div>
      <FileFeedClient
        files={files}
        teams={teams}
        lastSyncedAt={lastSyncedAt}
        connected={status.connected}
      />
    </div>
  )
}
