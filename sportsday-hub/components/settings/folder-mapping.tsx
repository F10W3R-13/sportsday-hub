'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Team } from '@/lib/types/models'

function extractFolderId(url: string): string | null {
  // drive.google.com/drive/folders/XXXX 형식에서 ID 추출
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function FolderMapping({ teams }: { teams: Team[] }) {
  const router = useRouter()
  const [folderUrls, setFolderUrls] = useState<Record<string, string>>(
    Object.fromEntries(
      teams.map((t) => [t.id, t.drive_folder_id ? `https://drive.google.com/drive/folders/${t.drive_folder_id}` : ''])
    )
  )
  const [saving, setSaving] = useState(false)
  const [parentUrl, setParentUrl] = useState('')
  const [autoMapping, setAutoMapping] = useState(false)
  const [autoMapResult, setAutoMapResult] = useState<Record<string, string | null> | null>(null)

  const handleAutoMap = async () => {
    setAutoMapping(true)
    try {
      const res = await fetch('/api/drive/auto-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolderUrl: parentUrl }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAutoMapResult(data.mapping)
      toast.success(`자동 매핑 완료! ${data.sync?.totalFiles ?? 0}개 파일 동기화됨.`)
      router.refresh()
    } catch {
      toast.error('자동 매핑 실패. URL을 확인해주세요.')
    } finally {
      setAutoMapping(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 각 팀의 폴더 ID 추출 후 DB 업데이트
      const updates = teams.map((team) => {
        const url = folderUrls[team.id] ?? ''
        const folderId = url.trim() ? extractFolderId(url) : null
        return { id: team.id, drive_folder_id: folderId }
      })

      // API 호출 (Route Handler 또는 직접 Supabase)
      const res = await fetch('/api/drive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_folders', updates }),
      })

      if (!res.ok) throw new Error()
      toast.success('폴더 매핑이 저장되었습니다.')
      router.refresh()
    } catch {
      toast.error('저장 실패. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-2 text-lg font-semibold">📂 팀 폴더 매핑</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        각 팀의 구글 드라이브 폴더 URL을 입력하세요.
      </p>

      <div className="mb-6 rounded-md bg-muted/50 p-3">
        <h3 className="mb-2 text-sm font-medium">🚀 빠른 설정 (권장)</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          상위 폴더 URL 하나만 입력하면 하위 폴더를 자동으로 찾아 팀별로 매핑합니다.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://drive.google.com/drive/folders/..."
            value={parentUrl}
            onChange={(e) => setParentUrl(e.target.value)}
            className="h-9"
          />
          <Button onClick={handleAutoMap} disabled={autoMapping || !parentUrl.trim()}>
            {autoMapping ? '매핑 중...' : '자동 매핑'}
          </Button>
        </div>
        {autoMapResult && (
          <div className="mt-2 space-y-1 text-xs">
            {Object.entries(autoMapResult).map(([teamId, folderId]) => (
              <div key={teamId}>
                {folderId ? '✅' : '⚠️'} {teamId}: {folderId ? '매핑됨' : '폴더를 찾지 못함'}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <span className="w-24 shrink-0 text-sm font-medium">{team.name}</span>
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderUrls[team.id] ?? ''}
              onChange={(e) =>
                setFolderUrls((prev) => ({ ...prev, [team.id]: e.target.value }))
              }
              className="h-9"
            />
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} className="mt-4">
        {saving ? '저장 중...' : '저장하고 동기화'}
      </Button>
    </div>
  )
}
