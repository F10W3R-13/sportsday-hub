'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { daysUntilEvent } from '@/lib/dday'

/**
 * D-day 카운트다운 배지 — 상단 헤더 등 사이드바 밖에서도 행사 임박도를 보여준다.
 * 자정 경과 시 자동 갱신을 위해 1분마다 재계산.
 */
export function DdayBadge() {
  const [days, setDays] = useState(() => daysUntilEvent())
  useEffect(() => {
    const id = setInterval(() => setDays(daysUntilEvent()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const isEventDay = days === 0

  return (
    <span
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tabular-nums ${
        isEventDay
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'text-muted-foreground'
      }`}
      aria-label={`행사일까지 ${days}일 남았습니다`}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      {isEventDay ? 'D-DAY' : `D-${days}`}
    </span>
  )
}
