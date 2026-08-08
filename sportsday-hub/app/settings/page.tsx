import { FolderMapping } from '@/components/settings/folder-mapping'
import { getDriveConnectionStatus } from '@/lib/drive/sync'
import { getTeams } from '@/lib/queries/teams'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [status, teams] = await Promise.all([
    getDriveConnectionStatus(),
    getTeams(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">⚙️ 설정</h1>
        <p className="text-sm text-muted-foreground">
          구글 드라이브 연동 관리
        </p>
      </div>

      {/* 연결 상태 */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">📁 구글 드라이브 연결</h2>
        {status.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-green-600">
              ✓ 연결됨: {status.email}
            </p>
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-muted"
            >
              다른 계정으로 재연결
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              구글 드라이브가 연결되지 않았습니다.
            </p>
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              구글 드라이브 연결하기
            </a>
          </div>
        )}
      </div>

      {/* 폴더 매핑 — 기획관리팀은 제외 (드라이브 폴더 없음) */}
      {status.connected && (
        <FolderMapping teams={teams.filter((t) => t.id !== 'management')} />
      )}
    </div>
  )
}
