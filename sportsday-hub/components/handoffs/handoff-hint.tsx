import { ExternalLink } from 'lucide-react'
import type { RecentFileItem } from '@/lib/types/models'

// 주는 팀의 최신 파일 자동 힌트 (스펙 §6) — 파일 없으면 조용한 안내
export function HandoffHint({ file }: { file?: RecentFileItem | null }) {
  if (!file) {
    return <span className="text-xs text-muted-foreground/50">최근 파일 없음</span>
  }
  return (
    <span className="text-xs text-muted-foreground">
      최근:{' '}
      {file.web_view_link ? (
        <a
          href={file.web_view_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-[160px] items-center gap-0.5 truncate align-bottom hover:underline"
          title={file.name}
        >
          {file.name}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="truncate">{file.name}</span>
      )}
    </span>
  )
}
