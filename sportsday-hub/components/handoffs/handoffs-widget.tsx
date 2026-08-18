import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { HandoffRow } from './handoff-row'
import { latestFileByTeamMap, sortHandoffs } from '@/lib/handoff'
import type { HandoffItem, RecentFileItem } from '@/lib/types/models'

// 대시보드 인계 현황 위젯 (스펙 §6) — 미완료 urgency순 6건, 파일 피드 위젯 아래 배치
export function HandoffsWidget({
  handoffs,
  recentFiles,
}: {
  handoffs: HandoffItem[]
  recentFiles: RecentFileItem[]
}) {
  const sorted = sortHandoffs(handoffs).slice(0, 6)
  const latestByTeam = latestFileByTeamMap(recentFiles)

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">🤝 인계 현황</h3>
        <Link href="/handoffs" className="text-xs font-medium text-primary hover:underline">
          전체 보기 →
        </Link>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="등록된 인계가 없습니다"
          description="/handoffs에서 팀 간 인계를 등록하세요."
        />
      ) : (
        <div className="space-y-1">
          {sorted.map((h) => (
            <HandoffRow key={h.id} handoff={h} hintFile={latestByTeam.get(h.from_team_id)} />
          ))}
        </div>
      )}
    </section>
  )
}
