'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { validateHandoffTarget } from '@/lib/handoff'
import type { ChecklistItem, Handoff, Team } from '@/lib/types/models'

export interface HandoffFormValues {
  fromTeamId: string
  toTeamId: string | null
  toExternal: string | null
  title: string
  dueDate: string | null
  checklistItemId: string | null
}

// 등록(initial=null)·편집(initial=Handoff) 겸용. 저장은 부모가 뮤테이션으로.
// 상태 재동기화는 useEffect 없이 조건부 마운트로 해결 — 부모가 {formOpen && ...}로
// 열 때마다 새로 마운트하므로 useState 초기값이 매번 current initial을 읽는다
// (guideline-viewer의 MarkdownEditDialog 패턴 준용, react-hooks/set-state-in-effect 회피).
export function HandoffFormDialog({
  open,
  onClose,
  teams,
  checklistItems,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  teams: Team[]
  checklistItems: ChecklistItem[]
  initial: Handoff | null
  onSave: (values: HandoffFormValues) => void
}) {
  const [fromTeamId, setFromTeamId] = useState(initial?.from_team_id ?? '')
  const [toTeamId, setToTeamId] = useState<string>(initial?.to_team_id ?? '')
  const [toExternal, setToExternal] = useState(initial?.to_external ?? '')
  const [isExternal, setIsExternal] = useState(initial ? initial.to_team_id === null : false)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [checklistItemId, setChecklistItemId] = useState<string>(
    initial?.checklist_item_id ?? 'none'
  )
  const [error, setError] = useState<string | null>(null)

  // Base UI Select 라벨 맵 — SelectValue가 원시 id 대신 이름을 렌더하도록
  const teamLabels = Object.fromEntries(teams.map((t) => [t.id, t.name]))
  const checklistLabels: Record<string, string> = Object.fromEntries(
    checklistItems.map((c) => [c.id, c.content.slice(0, 30)])
  )

  const handleSave = () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!fromTeamId) {
      setError('주는 팀을 선택해주세요.')
      return
    }
    const targetError = validateHandoffTarget(
      isExternal ? null : toTeamId || null,
      isExternal ? toExternal : null
    )
    if (targetError) {
      setError(targetError)
      return
    }
    if (!isExternal && toTeamId && toTeamId === fromTeamId) {
      setError('주는 팀과 받는 팀은 달라야 합니다.')
      return
    }
    onSave({
      fromTeamId,
      toTeamId: isExternal ? null : toTeamId || null,
      toExternal: isExternal ? toExternal.trim() : null,
      title: title.trim(),
      dueDate: dueDate || null,
      checklistItemId: checklistItemId === 'none' ? null : checklistItemId,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? '인계 편집' : '인계 등록'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">주는 팀</label>
            <Select
              value={fromTeamId}
              onValueChange={(v) => setFromTeamId(v ?? '')}
              items={teamLabels}
            >
              <SelectTrigger>
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">받는 쪽</label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isExternal}
                  onChange={(e) => setIsExternal(e.target.checked)}
                />
                외부 조직
              </label>
            </div>
            {isExternal ? (
              <Input
                value={toExternal}
                onChange={(e) => setToExternal(e.target.value)}
                placeholder="예: 홍보부"
              />
            ) : (
              <Select
                value={toTeamId}
                onValueChange={(v) => setToTeamId(v ?? '')}
                items={teamLabels}
              >
                <SelectTrigger>
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">무엇을</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 게임별 필요 인원·물품 리스트"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">기한 (선택)</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              관련 체크리스트 (선택)
            </label>
            <Select
              value={checklistItemId}
              onValueChange={(v) => setChecklistItemId(v ?? 'none')}
              items={{ none: '없음', ...checklistLabels }}
            >
              <SelectTrigger>
                <SelectValue placeholder="없음" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음</SelectItem>
                {checklistItems.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.content.slice(0, 30)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
