// lib/checklist-focus-url.ts
// 긴급 체크리스트 위젯 → 팀 체크리스트 탭 특정 항목 딥링크 URL.
// teamId가 없으면 링크를 만들 수 없어 null (호출측은 비클릭 행으로 렌더).
export function buildChecklistFocusUrl(
  teamId: string | null | undefined,
  itemId: string
): string | null {
  if (!teamId) return null
  return `/team/${teamId}?tab=checklist&focus=${itemId}`
}
