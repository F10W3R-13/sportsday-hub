'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { daysUntil } from '@/lib/dday'

/**
 * D-day 카운트다운 배지 — 상단 헤더 등 사이드바 밖에서도 행사 임박도를 보여준다.
 * 행사일은 서버(sidebar.tsx)가 DB(app_config)에서 읽어 props로 전달한다.
 * 자정 경과 시 자동 갱신을 위해 1분마다 재계산.
 */
export function DdayBadge({ dateIso }: { dateIso: string }) {
  const [days, setDays] = useState(() => daysUntil(dateIso))
  // props로 받은 행사일이 바뀌면(시즌 리셋 직후 등) 렌더 중 즉시 재계산 —
  // React 공식 "props 변경에 상태 조정" 패턴 (추가 렌더 유발 없음)
  const [prevIso, setPrevIso] = useState(dateIso)
  if (prevIso !== dateIso) {
    setPrevIso(dateIso)
    setDays(daysUntil(dateIso))
  }
  useEffect(() => {
    const id = setInterval(() => setDays(daysUntil(dateIso)), 60 * 1000)
    return () => clearInterval(id)
  }, [dateIso])

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
