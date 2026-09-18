'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GAMES } from '@/lib/dayof/data'
import { friendlyFor, warnFriendly } from '@/lib/dayof/copy'
import {
  cleanTitle,
  getProfile,
  getScheduleFor,
  getWarningsFor,
  listNames,
  phaseFor,
  type ItemPhase,
  type ScheduleItem,
} from '@/lib/dayof/schedule'
import { EVENT_DATE_ISO } from '@/lib/dday'

const SOURCE_META: Record<ScheduleItem['source'], { label: string; chip: string }> = {
  gather: { label: '아침 집합', chip: 'bg-sky-100 text-sky-700' },
  slot: { label: '배치', chip: 'bg-slate-100 text-slate-600' },
  common: { label: '전원 공통', chip: 'bg-gray-100 text-gray-500' },
  flow: { label: '입장 수속', chip: 'bg-violet-100 text-violet-700' },
  game: { label: '게임', chip: 'bg-primary text-primary-foreground' },
  afternoon: { label: '오후 담당', chip: 'bg-orange-100 text-orange-700' },
}

function isEventDay(d: Date): boolean {
  const [y, m, day] = EVENT_DATE_ISO.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day
}

/** 드롭다운 안의 라벨+내용 한 덩어리. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: ItemPhase }) {
  if (phase === 'current')
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" /> 진행 중
      </span>
    )
  if (phase === 'past')
    return (
      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">
        지남
      </span>
    )
  return null
}

function ItemDetails({ item }: { item: ScheduleItem }) {
  const game = item.gameIdx !== undefined ? GAMES.find((g) => g.idx === item.gameIdx) : undefined
  const friendly = friendlyFor(item)

  let sections: React.ReactNode = null
  if (game) {
    sections = (
      <>
        {item.detail && <Section label="내 할 일">{item.detail}</Section>}
        {item.peers && <Section label="같은 역할 담당">{item.peers}</Section>}
        <Section label="이 게임의 전체 담당">
          <ul className="list-disc space-y-0.5 pl-4">
            {game.assign.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
        <Section label="게임 규칙">
          <ul className="list-disc space-y-0.5 pl-4">
            {game.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Section>
        <Section label="준비물">{game.items}</Section>
        <Section label="경기 운영">
          {game.dur}
          {game.special ? ` · 점수 — ${game.special}` : ''}
        </Section>
        <Section label="운영 메모">{game.note}</Section>
      </>
    )
  } else if (item.source === 'flow') {
    sections = (
      <>
        <Section label="내 할 일">{item.detail}</Section>
        {item.peers && <Section label="이 단계 함께 담당">{item.peers}</Section>}
      </>
    )
  } else if (item.source === 'slot') {
    sections = (
      <>
        {item.detail && <Section label="시간대">{item.detail}</Section>}
        {item.headcount !== undefined && (
          <Section label="배치 규모">이 배치 총원 {item.headcount}명 (조장 = 첫 담당자)</Section>
        )}
      </>
    )
  } else if (item.source === 'gather') {
    sections = <Section label="집합 조·장소">{item.detail}</Section>
  } else if (item.source === 'afternoon') {
    sections = <Section label="원문 (당일 진행표 행 전체)">{item.detail}</Section>
  }

  if (!sections) return null
  return (
    <details className="group mt-2">
      <summary className="flex w-fit cursor-pointer select-none items-center gap-1 text-sm font-medium text-muted-foreground list-none [&::-webkit-details-marker]:hidden">
        세부 내용
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3 border-l-2 border-border/70 pl-4">
        {friendly && (
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              👀 쉽게 설명
            </p>
            <div className="mt-0.5 text-sm leading-relaxed">{friendly}</div>
          </div>
        )}
        {sections}
      </div>
    </details>
  )
}

function TimelineItem({
  item,
  name,
  phase,
  isNext,
}: {
  item: ScheduleItem
  name: string
  phase: ItemPhase | null
  isNext: boolean
}) {
  const meta = SOURCE_META[item.source]
  const title = cleanTitle(item.title, name)
  const game = item.gameIdx !== undefined ? GAMES.find((g) => g.idx === item.gameIdx) : undefined

  const dot =
    phase === 'current'
      ? 'bg-emerald-500 animate-pulse'
      : phase === 'past'
        ? 'bg-gray-300'
        : isNext
          ? 'bg-blue-500'
          : 'bg-border'
  const card =
    phase === 'current'
      ? 'border-emerald-400 bg-emerald-50/40'
      : isNext
        ? 'border-blue-400'
        : 'border-border'

  return (
    <li className={`relative pl-7 ${phase === 'past' ? 'opacity-55' : ''}`}>
      <span
        className={`absolute -left-[9px] top-5 size-4 rounded-full border-2 border-background ${dot}`}
      />
      <div className={`rounded-xl border-2 p-4 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{item.time}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
            {meta.label}
          </span>
          {phase && <PhaseBadge phase={phase} />}
          {isNext && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
              다음
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-xl leading-snug font-bold">
          {title}
          {item.role && (
            <span className="ml-2 align-middle rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
              {item.role}
            </span>
          )}
          {game?.main && (
            <span className="ml-1 align-middle rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              메인 · 배점 ×1.5
            </span>
          )}
        </h3>
        <ItemDetails item={item} />
      </div>
    </li>
  )
}

function ResultView({ name }: { name: string }) {
  const profile = getProfile(name)
  const items = getScheduleFor(name)
  const warnings = getWarningsFor(name)

  // 당일에만 실시간 상태(진행 중/다음/지남)를 계산하고 30초마다 갱신한다.
  const eventDay = useMemo(() => isEventDay(new Date()), [])
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    if (!eventDay) return
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [eventDay])
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextIdx = eventDay ? items.findIndex((i) => phaseFor(i, nowMin) === 'future') : -1

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-3xl font-bold">{name}</h2>
          <span className="text-sm text-muted-foreground">당일 담당 {items.length}건</span>
          {eventDay && (
            <span className="font-mono text-sm text-muted-foreground">
              현재 {String(now.getHours()).padStart(2, '0')}:
              {String(now.getMinutes()).padStart(2, '0')}
            </span>
          )}
        </div>
        {profile.badges.length > 0 && (
          <ul className="space-y-1">
            {profile.badges.map((b) => (
              <li key={b.label} className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                  {b.label}
                </span>
                <span className="text-sm text-muted-foreground">{b.desc}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-800">⚠ 담당 겹침 주의</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-amber-800">
            {warnings.map((w) => {
              const wf = warnFriendly(w)
              return (
                <li key={w}>
                  {w}
                  {wf && <p className="mt-0.5 list-none text-amber-700/90">👀 {wf}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ol className="relative ml-2 space-y-4 border-l-2 border-muted-foreground/30">
        {items.map((item, i) => (
          <TimelineItem
            key={`${item.sortKey}-${item.title}`}
            item={item}
            name={name}
            phase={eventDay ? phaseFor(item, nowMin) : null}
            isNext={i === nextIdx}
          />
        ))}
      </ol>
    </div>
  )
}

export function MyRoleClient() {
  const [name, setName] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-1 bg-background/95 py-2 backdrop-blur">
        <Select value={name} onValueChange={(v) => setName(v)}>
          <SelectTrigger className="w-full text-base font-semibold sm:w-72" aria-label="이름 선택">
            <SelectValue>{(v: string | null) => v ?? '📌 내 이름 선택'}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {listNames().map((n) => (
              <SelectItem key={n} value={n} className="text-base">
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {name === null ? (
        <div className="rounded-xl border-2 border-dashed p-6 text-center">
          <p className="text-lg font-semibold">이름을 선택하면 나의 당일 일정이 나옵니다</p>
          <p className="mt-1 text-sm text-muted-foreground">
            시간순 타임라인 · 각 항목을 펼쳐 세부 지시·규칙·준비물까지 확인
          </p>
        </div>
      ) : (
        <ResultView name={name} />
      )}
    </div>
  )
}
