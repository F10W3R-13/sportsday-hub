'use client'

import { Suspense, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/shared/filter-chip'
import { DriveSyncTrigger } from './drive-sync-trigger'
import { RecentFileRow } from './recent-file-row'
import { EmptyState } from '@/components/shared/empty-state'
import { parseTeamFilter } from '@/lib/file-feed'
import { timeAgo } from '@/lib/format/time-ago'
import { toast } from 'sonner'
import type { RecentFileItem, Team } from '@/lib/types/models'

interface FileFeedClientProps {
  files: RecentFileItem[]
  teams: Team[]
  lastSyncedAt: string | null
  connected: boolean
}

// useSearchParams는 정적 렌더링에서 Suspense 경계 필수 (team-tabs 패턴 준용)
export function FileFeedClient(props: FileFeedClientProps) {
  return (
    <Suspense fallback={null}>
      <FileFeedInner {...props} />
    </Suspense>
  )
}

function FileFeedInner({ files, teams, lastSyncedAt, connected }: FileFeedClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [syncing, setSyncing] = useState(false)

  // 필터는 URL(?team=)이 진실 원천 — 무효 값은 '전체' 폴백 (스펙 §5)
  const teamFilter = parseTeamFilter(searchParams.get('team'))
  const visible = teamFilter ? files.filter((f) => f.team.id === teamFilter) : files

  const handleChip = (id: string | null) => {
    router.replace(id ? `${pathname}?team=${id}` : pathname, { scroll: false })
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      if (res.status === 401) {
        toast.error('드라이브 연결이 필요합니다.')
        return
      }
      if (!res.ok) throw new Error()
      toast.success('동기화 완료.')
      router.refresh()
    } catch {
      toast.error('동기화 실패. 잠시 후 다시 시도해주세요.')
    } finally {
      setSyncing(false)
    }
  }

  if (!connected) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          구글 드라이브가 연결되지 않았습니다. 연결 후 파일이 표시됩니다.
        </p>
        <Button className="mt-4" render={<Link href="/settings" />}>
          설정에서 연결하기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={teamFilter === null} onClick={() => handleChip(null)}>
          전체
        </FilterChip>
        {teams.map((team) => (
          <FilterChip
            key={team.id}
            active={teamFilter === team.id}
            color={team.color}
            onClick={() => handleChip(team.id)}
          >
            {team.name}
          </FilterChip>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {lastSyncedAt ? `마지막 동기화 ${timeAgo(lastSyncedAt)}` : '동기화 이력 없음'}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={syncing}
          className="text-muted-foreground"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '동기화 중...' : '동기화'}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="파일이 없습니다"
          description="해당 팀 폴더에 파일이 없거나 아직 동기화되지 않았습니다."
        />
      ) : (
        <div className="space-y-1">
          {visible.map((file) => (
            <RecentFileRow key={file.id} file={file} showCreatedDate />
          ))}
        </div>
      )}

      <DriveSyncTrigger />
    </div>
  )
}

