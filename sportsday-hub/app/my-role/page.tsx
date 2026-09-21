import { ChevronDown } from 'lucide-react'
import { MyRoleClient } from '@/components/my-role/my-role-client'
import { COMMON_FOOTER, GATHER, NOTE_GAME_JOIN } from '@/lib/dayof/data'
import { getEventConfig } from '@/lib/config'

function GatherGroupCard({ group }: { group: (typeof GATHER)['myeongryun'] }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-lg font-bold">{group.title}</p>
      <p className="font-mono text-sm text-muted-foreground">{group.chip}</p>
      <p className="mt-1 text-sm text-muted-foreground">{group.who}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {group.rows.map((row) => (
          <li key={`${row.t}-${row.d}`}>
            <span className="font-mono text-muted-foreground">{row.t}</span> — {row.d} ·{' '}
            <span className="font-medium">{row.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function MyRolePage() {
  // 행사일은 DB(app_config)에서 — 당일 실시간 진행상태 판정에 쓰인다
  const config = await getEventConfig()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">내 역할</h1>
        <p className="text-sm text-muted-foreground">
          스포츠데이 당일 — 이름을 선택하면 담당 역할과 일정이 시간순으로 표시됩니다
        </p>
      </div>
      <MyRoleClient eventDateIso={config.eventDateIso} />
      <section className="rounded-xl border">
        <details className="group p-4">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-base font-bold list-none [&::-webkit-details-marker]:hidden">
            📍 당일 공통 안내 (전원) — 집합·우천·대기
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-4">
            <ul className="space-y-1">
              {GATHER.chips.map(([t, d]) => (
                <li key={t} className="text-sm">
                  <span className="font-mono font-semibold">{t}</span> — {d}
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <GatherGroupCard group={GATHER.myeongryun} />
              <GatherGroupCard group={GATHER.yuljeon} />
            </div>
            <p className="text-sm text-muted-foreground">🕒 {GATHER.wait}</p>
            <p className="text-sm text-muted-foreground">🌧 {GATHER.weather}</p>
            <p className="text-sm text-muted-foreground">🎮 {NOTE_GAME_JOIN}</p>
            <p className="text-sm text-muted-foreground">{COMMON_FOOTER}</p>
          </div>
        </details>
      </section>
    </div>
  )
}
