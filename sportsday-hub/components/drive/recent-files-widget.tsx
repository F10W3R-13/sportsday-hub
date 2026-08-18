import Link from 'next/link'
import { DriveSyncTrigger } from './drive-sync-trigger'
import { RecentFileRow } from './recent-file-row'
import { EmptyState } from '@/components/shared/empty-state'
import { timeAgo } from '@/lib/format/time-ago'
import type { RecentFileItem } from '@/lib/types/models'

// 대시보드 전체 팀 파일 피드 위젯 (스펙 §5) — 최근 8건, UrgentChecklist와 팀별 현황 사이 배치
export function RecentFilesWidget({
  files,
  lastSyncedAt,
  connected,
}: {
  files: RecentFileItem[]
  lastSyncedAt: string | null
  connected: boolean
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">📁 최근 파일 활동</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastSyncedAt && <span>마지막 동기화 {timeAgo(lastSyncedAt)}</span>}
          <Link href="/files" className="font-medium text-primary hover:underline">
            전체 보기 →
          </Link>
        </div>
      </div>

      {!connected ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          구글 드라이브 연결이 필요합니다.{' '}
          <Link href="/settings" className="text-primary hover:underline">
            설정에서 연결
          </Link>
          해주세요.
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          title="동기화된 파일이 없습니다"
          description="드라이브 폴더에 파일을 올리면 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <RecentFileRow key={file.id} file={file} />
          ))}
        </div>
      )}

      {connected && <DriveSyncTrigger />}
    </section>
  )
}
