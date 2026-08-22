'use client'

import { Suspense, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/shared/filter-chip'
import { EmptyState } from '@/components/shared/empty-state'
import { HandoffRow } from './handoff-row'
import { HandoffFormDialog, type HandoffFormValues } from './handoff-form-dialog'
import { latestFileByTeamMap, parseHandoffToFilter, sortHandoffs } from '@/lib/handoff'
import {
  useCreateHandoff,
  useDeleteHandoff,
  useToggleHandoff,
  useUpdateHandoff,
  type HandoffInput,
} from '@/lib/mutations/handoffs'
import type {
  Handoff,
  HandoffItem,
  Milestone,
  RecentFileItem,
  Team,
  TeamId,
} from '@/lib/types/models'

interface HandoffsClientProps {
  handoffs: HandoffItem[]
  teams: Team[]
  milestones: Milestone[]
  recentFiles: RecentFileItem[]
}

// useSearchParams는 정적 렌더링에서 Suspense 경계 필수 (file-feed-client 패턴 준용)
export function HandoffsClient(props: HandoffsClientProps) {
  return (
    <Suspense fallback={null}>
      <HandoffsInner {...props} />
    </Suspense>
  )
}

function HandoffsInner({ handoffs, teams, milestones, recentFiles }: HandoffsClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Handoff | null>(null)
  // 완료 토글 optimistic — 체크 즉시 뒤집고, router.refresh로 도착한 서버 데이터가 덮어쓴다
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const displayCompleted = (h: HandoffItem) => overrides[h.id] ?? h.completed

  const createMutation = useCreateHandoff()
  const updateMutation = useUpdateHandoff()
  const toggleMutation = useToggleHandoff()
  const deleteMutation = useDeleteHandoff()

  // 필터는 URL(?to=)이 진실 원천 — 팀 id 또는 'external', 무효 값 '전체' 폴백
  const toFilter = parseHandoffToFilter(searchParams.get('to'))
  const visible = toFilter
    ? handoffs.filter((h) =>
        toFilter === 'external' ? h.to_team === null : h.to_team?.id === toFilter
      )
    : handoffs
  const sorted = sortHandoffs(
    visible.map((h) => ({ ...h, completed: displayCompleted(h) }))
  )
  const latestByTeam = latestFileByTeamMap(recentFiles)

  const handleToggle = (h: HandoffItem) => {
    setOverrides((prev) => ({ ...prev, [h.id]: !displayCompleted(h) }))
    toggleMutation.mutate(h)
  }

  const handleChip = (value: string | null) => {
    router.replace(value ? `${pathname}?to=${value}` : pathname, { scroll: false })
  }

  const handleSave = (values: HandoffFormValues) => {
    // 폼 Select의 팀 id는 Team.id에서만 유래하므로 런타임 정합 — HandoffInput(TeamId)으로 좁힘
    const input: HandoffInput = {
      ...values,
      fromTeamId: values.fromTeamId as TeamId,
      toTeamId: values.toTeamId as TeamId | null,
    }
    if (editing) updateMutation.mutate({ id: editing.id, ...input })
    else createMutation.mutate(input)
  }

  const handleDelete = (h: HandoffItem) => {
    if (window.confirm(`'${h.title}' 인계를 삭제할까요?`)) deleteMutation.mutate(h.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={toFilter === null} onClick={() => handleChip(null)}>
          전체
        </FilterChip>
        {teams.map((t) => (
          <FilterChip
            key={t.id}
            active={toFilter === t.id}
            color={t.color}
            onClick={() => handleChip(t.id)}
          >
            {t.name}
          </FilterChip>
        ))}
        <FilterChip
          active={toFilter === 'external'}
          onClick={() => handleChip('external')}
        >
          외부
        </FilterChip>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> 인계 등록
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="해당 조건에 인계가 없습니다"
          description="인계 등록 버튼으로 새 인계를 추가할 수 있습니다."
        />
      ) : (
        <div className="space-y-1">
          {sorted.map((h) => (
            <div key={h.id} className="flex items-center gap-1">
              {/* label로 클릭 영역 확장 — 모바일 터치 타겟 44px 확보 */}
              <label className="flex shrink-0 cursor-pointer items-center p-2.5 -m-2.5">
                <input
                  type="checkbox"
                  checked={h.completed}
                  onChange={() => handleToggle(h)}
                  className="h-4 w-4 cursor-pointer"
                  title="완료 토글"
                  aria-label={`${h.title} 완료 여부`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <HandoffRow
                  handoff={h}
                  hintFile={latestByTeam.get(h.from_team_id)}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        className="shrink-0 text-muted-foreground"
                        onClick={() => {
                          setEditing(h)
                          setFormOpen(true)
                        }}
                      >
                        편집
                      </Button>
                      <Button
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(h)}
                      >
                        삭제
                      </Button>
                    </>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 열 때마다 마운트 — 폼 초기값이 current editing을 반영 (guideline-viewer 패턴) */}
      {formOpen && (
        <HandoffFormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          teams={teams}
          milestones={milestones}
          initial={editing}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

