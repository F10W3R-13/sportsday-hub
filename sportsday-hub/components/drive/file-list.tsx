'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DriveFileIcon } from './drive-icon'
import { timeAgo } from '@/lib/format/time-ago'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { DriveFile, TeamId } from '@/lib/types/models'

export function FileList({
  files,
  teamId,
}: {
  files: DriveFile[]
  teamId?: TeamId
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

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          📁 드라이브 파일{files.length > 0 && ` (${files.length})`}
        </h3>
        {teamId && (
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
        )}
      </div>

      {files.length === 0 ? (
        <EmptyState
          title="파일이 없습니다"
          description="구글 드라이브 폴더에 파일이 없거나 아직 동기화되지 않았습니다."
        />
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
            >
              <DriveFileIcon mimeType={file.mime_type} className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {file.modified_time && `${timeAgo(file.modified_time)} · `}
                  {file.modified_by ?? '알 수 없음'}
                </div>
              </div>
              {file.web_view_link && (
                <a
                  href={file.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-2 hover:bg-muted transition-colors"
                  title="드라이브에서 열기"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
