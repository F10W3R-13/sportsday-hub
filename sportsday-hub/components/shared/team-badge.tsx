import { readableColor } from '@/lib/color'

/**
 * 팀명 배지 — DB의 팀 색상은 밝은 톤(amber·emerald 등)이 있어
 * 그대로 쓰면 흰 배경 대비 AA 미달. readableColor로 본문 대비(4.5:1) 보정.
 */
export function TeamBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: readableColor(color),
      }}
    >
      {name}
    </span>
  )
}
