// tests/checklist-focus-url.test.ts
import { describe, it, expect } from 'vitest'
import { buildChecklistFocusUrl } from '@/lib/checklist-focus-url'

describe('lib/checklist-focus-url — 위젯 딥링크 URL 생성', () => {
  it('팀 ID + 항목 ID로 체크리스트 탭 포커스 URL 조합', () => {
    expect(buildChecklistFocusUrl('budget', 'item-42')).toBe(
      '/team/budget?tab=checklist&focus=item-42'
    )
  })

  it('teamId 없음 → null (호출측에서 링크 렌더 안 함)', () => {
    expect(buildChecklistFocusUrl(null, 'item-1')).toBeNull()
    expect(buildChecklistFocusUrl(undefined, 'item-1')).toBeNull()
    expect(buildChecklistFocusUrl('', 'item-1')).toBeNull()
  })
})
