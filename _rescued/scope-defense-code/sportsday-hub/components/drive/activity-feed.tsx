'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, ChevronRight, CheckCircle2, GitBranch, AlertCircle } from 'lucide-react'
import { DriveFileIcon } from './drive-icon'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ActivityFeedItem, TeamId } from '@/lib/types/models'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

function ActivityIcon({ item }: { item: ActivityFeedItem }) {
  if (item.type === 'file') {
    return <DriveFileIcon mimeType={item.mimeType} className="h-4 w-4 shrink-0 text-blue-500" />
  }
  if (item.type === 'checklist') return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
  if (item.type === 'decision') return <GitBranch className="h-4 w-4 shrink-0 text-purple-500" />
  return <AlertCircle className="h-4 w-4 shrink-0 text-orange-500" />
}

export function ActivityFeed({
  items,
  teamId,
}: {
  items: ActivityFeedItem[]
  teamId: TeamId
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, force: true }),
      })
      if (res.status === 401) {
        toast.error('드라이브 연결이 필요합니다. 기획관리팀에 문의해주세요.')
        return
      }
      if (!res.ok) throw new Error()
      toast.success('최신 상태로 동기화되었습니다.')
      router.refresh()
    } catch {
      toast.error('동기화 실패. 잠시 후 다시 시도해주세요.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">📌 최근 활동</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSync}
          disabled={syncing}
          className="text-muted-foreground"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '동기화 중...' : '새로고침'}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          최근 활동이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <ActivityIcon item={item} />
              <div className="min-w-0 flex-1">
                <span className="truncate">{item.title}</span>
                {item.actor && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {timeAgo(item.timestamp)} · {item.actor}
                  </span>
                )}
              </div>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-1 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
