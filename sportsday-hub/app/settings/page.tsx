import { redirect } from 'next/navigation'
import { FolderMapping } from '@/components/settings/folder-mapping'
import { getDriveConnectionStatus } from '@/lib/drive/sync'
import { getTeams } from '@/lib/queries/teams'
import { IS_DEMO } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  // 데모 인스턴스에는 구글 드라이브 연동이 없다 — 실제 연결 UI 노출/오 유발 방지
  if (IS_DEMO) redirect('/')

  const [status, teams] = await Promise.all([
    // 상태 조회 실패(토큰 복호화 오류 등)는 미연결로 취급 — 페이지 전체가 죽지 않도록 (스펙 §7)
    getDriveConnectionStatus().catch(() => ({ connected: false, email: null })),
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
              ✓ 연결됨
              {status.email && status.email !== 'unknown'
                ? `: ${status.email}`
                : ' (계정 정보를 가져올 수 없습니다)'}
            </p>
            <a
              href="/api/auth/google-connect"
              className="inline-block rounded-md border px-3 py-1 text-sm hover:bg-muted"
            >
              다른 계정으로 재연결 (현재 연결이 교체됩니다)
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

      {/* 폴더 매핑 */}
      {status.connected && (
        <FolderMapping teams={teams} />
      )}
    </div>
  )
}
