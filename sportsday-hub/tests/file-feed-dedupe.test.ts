import { describe, it, expect } from 'vitest'
import { dedupeRecentFiles } from '@/lib/file-feed'
import type { RecentFileItem } from '@/lib/types/models'

function file(partial: Partial<RecentFileItem>): RecentFileItem {
  const id = partial.id ?? crypto.randomUUID()
  const base: RecentFileItem = {
    id,
    team_id: 'management',
    file_id: `g-${id}`,
    name: '파일',
    mime_type: 'application/pdf',
    icon_link: null,
    web_view_link: null,
    modified_time: null,
    modified_by: null,
    created_time: null,
    team: { id: 'management', name: '기획관리팀', color: '#000', icon: '📁' },
  }
  return { ...base, ...partial } as RecentFileItem
}

describe('dedupeRecentFiles', () => {
  it('같은 이름의 중복 파일 중 최신 것만 남긴다', () => {
    const files = [
      file({ name: '가이드.md', modified_time: '2026-08-10T00:00:00Z' }),
      file({ name: '가이드.md', modified_time: '2026-08-19T00:00:00Z' }),
    ]
    const result = dedupeRecentFiles(files)
    expect(result).toHaveLength(1)
    expect(result[0].modified_time).toBe('2026-08-19T00:00:00Z')
  })

  it('다른 파일은 모두 유지한다', () => {
    const files = [file({ name: 'a.docx' }), file({ name: 'b.xlsx' })]
    expect(dedupeRecentFiles(files)).toHaveLength(2)
  })

  it('id가 같으면 하나로 합친다', () => {
    const files = [
      file({ id: 'x', name: '이름1', modified_time: '2026-08-01T00:00:00Z' }),
      file({ id: 'x', name: '이름2', modified_time: '2026-08-02T00:00:00Z' }),
    ]
    expect(dedupeRecentFiles(files)).toHaveLength(1)
  })
})
