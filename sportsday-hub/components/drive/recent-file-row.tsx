import { ExternalLink, FilePen } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { DriveFileIcon } from './drive-icon'
import { isNewFile } from '@/lib/file-feed'
import { timeAgo } from '@/lib/format/time-ago'
import type { RecentFileItem } from '@/lib/types/models'

// 파일 피드 행 — 훅 없는 presentational이라 서버·클라이언트 양쪽에서 사용된다.
export function RecentFileRow({
  file,
  showCreatedDate = false,
}: {
  file: RecentFileItem
  showCreatedDate?: boolean
}) {
  const isNew = isNewFile(file.created_time)
  return (
    <div className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
      <DriveFileIcon mimeType={file.mime_type} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{file.name}</span>
          {isNew ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              NEW
            </span>
          ) : (
            <FilePen className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: file.team.color }}
            />
            {file.team.name}
          </span>
          <span>· {file.modified_time ? timeAgo(file.modified_time) : '—'}</span>
          <span>· {file.modified_by ?? '—'}</span>
          {showCreatedDate && file.created_time && (
            <span>· 생성 {format(parseISO(file.created_time), 'M월 d일', { locale: ko })}</span>
          )}
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
  )
}
