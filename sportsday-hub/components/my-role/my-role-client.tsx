'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GAMES } from '@/lib/dayof/data'
import {
  getProfile,
  getScheduleFor,
  getWarningsFor,
  listNames,
  type ScheduleItem,
} from '@/lib/dayof/schedule'

const SOURCE_LABEL: Record<ScheduleItem['source'], string> = {
  gather: '집합',
  slot: '배치',
  common: '공통',
  flow: '입장 수속',
  game: '게임',
  afternoon: '오후',
}

function GameCard({ item }: { item: ScheduleItem }) {
  const game = GAMES.find((g) => g.idx === item.gameIdx)
  return (
    <li className="rounded-lg border p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">{item.time}</span>
        <span className="font-semibold">{item.title}</span>
        {item.role && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            {item.role}
          </span>
        )}
        {game?.main && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            메인 · 배점 ×1.5
          </span>
        )}
      </div>
      {item.detail && <p className="text-sm">{item.detail}</p>}
      {game && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground select-none">
            게임 규칙 · 준비물 보기
          </summary>
          <div className="mt-2 space-y-1.5 pl-1">
            <ul className="list-disc space-y-0.5 pl-4">
              {game.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {game.special && <p className="text-muted-foreground">점수 — {game.special}</p>}
            <p className="text-muted-foreground">준비물 — {game.items}</p>
            <p className="text-muted-foreground">{game.note}</p>
          </div>
        </details>
      )}
    </li>
  )
}

export function MyRoleClient() {
  const [name, setName] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <Select value={name} onValueChange={(v) => setName(v)}>
        <SelectTrigger className="w-full sm:w-64" aria-label="이름 선택">
          <SelectValue>{(v: string | null) => v ?? '내 이름 선택'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {listNames().map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {name === null ? (
        <p className="text-sm text-muted-foreground">
          이름을 선택하면 당일 담당 역할과 일정이 시간순으로 표시됩니다.
        </p>
      ) : (
        <ResultView name={name} />
      )}
    </div>
  )
}

function ResultView({ name }: { name: string }) {
  const profile = getProfile(name)
  const items = getScheduleFor(name)
  const warnings = getWarningsFor(name)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold">{name}</h2>
          {profile.badges.map((b) => (
            <span
              key={b.label}
              title={b.desc}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
            >
              {b.label}
            </span>
          ))}
        </div>
        {profile.badges.length > 0 && (
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {profile.badges.map((b) => (
              <li key={b.label}>
                {b.label} — {b.desc}
              </li>
            ))}
          </ul>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-800">⚠ 담당 겹침 주의</p>
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-amber-800">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item, i) => {
          if (item.source === 'game') return <GameCard key={i} item={item} />
          const isCommon = item.source === 'common'
          return (
            <li
              key={i}
              className={`rounded-lg border p-3 ${isCommon ? 'bg-muted/40' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{item.time}</span>
                <span className={isCommon ? 'text-sm' : 'font-medium'}>{item.title}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {SOURCE_LABEL[item.source]}
                  {isCommon ? ' · 전원' : ''}
                </span>
              </div>
              {item.detail && (
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
