'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Team } from '@/lib/types/models'

export function FolderMapping({ teams }: { teams: Team[] }) {
  const router = useRouter()

  const handleResync = async () => {
    try {
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`동기화 완료! ${data.totalFiles ?? 0}개 파일.`)
      router.refresh()
    } catch {
      toast.error('동기화 실패. 다시 시도해주세요.')
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📂 팀 폴더 연결 상태</h2>
        <Button size="sm" variant="ghost" onClick={handleResync}>
          <RefreshCw className="mr-1 h-3 w-3" />
          지금 동기화
        </Button>
      </div>

      <div className="space-y-2">
        {teams.map((team) => {
          const connected = !!team.drive_folder_id
          return (
            <div
              key={team.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              {connected ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <span className="flex-1 text-sm font-medium">{team.name}</span>
              <span className={`text-xs ${connected ? 'text-green-600' : 'text-muted-foreground'}`}>
                {connected ? '✅ 자동 연결됨' : '드라이브에 폴더 없음'}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        구글 드라이브 연결 시 하위 폴더가 자동으로 매핑됩니다.
        드라이브에 새 파일을 추가하면 5분 내로 이 페이지에 반영됩니다.
      </p>
    </div>
  )
}
