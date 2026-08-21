'use client'

import { readableColor } from '@/lib/color'

/**
 * URL 쿼리 기반 리스트 필터 칩 (handoffs ?to= / files ?team= 공용).
 * 모바일 터치 타겟 44px 확보, 활성 팀 색상은 대비 보정 적용.
 */
export function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors md:min-h-9 md:px-3 md:text-xs ${
        active ? 'bg-primary/10' : 'text-muted-foreground hover:bg-muted'
      }`}
      style={
        active && color
          ? { borderColor: color, color: readableColor(color) }
          : undefined
      }
    >
      {children}
    </button>
  )
}
