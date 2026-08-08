import { ExternalLink } from 'lucide-react'
import { DriveFileIcon } from './drive-icon'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { EmptyState } from '@/components/shared/empty-state'
import type { DriveFile } from '@/lib/types/models'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`
  return format(parseISO(dateStr), 'M월 d일', { locale: ko })
}

export function FileList({ files }: { files: DriveFile[] }) {
  if (files.length === 0) {
    return <EmptyState title="파일이 없습니다" description="구글 드라이브 폴더에 파일이 없거나 아직 동기화되지 않았습니다." />
  }

  return (
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
  )
}
