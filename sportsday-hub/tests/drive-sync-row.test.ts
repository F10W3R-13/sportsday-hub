import { describe, it, expect } from 'vitest'
import { toDriveFileRow } from '@/lib/drive/sync'

const NOW = '2026-08-18T09:00:00.000Z'

describe('toDriveFileRow (드라이브 메타 → upsert 행)', () => {
  it('모든 필드 매핑 — created_time 포함', () => {
    const row = toDriveFileRow(
      'content',
      {
        id: 'file-1',
        name: '게임 규칙.pdf',
        mimeType: 'application/pdf',
        createdTime: '2026-08-17T10:00:00Z',
        modifiedTime: '2026-08-18T08:00:00Z',
        lastModifyingUser: { displayName: '민우' },
        webViewLink: 'https://drive.google.com/file/file-1',
      },
      NOW
    )
    expect(row).toEqual({
      team_id: 'content',
      file_id: 'file-1',
      name: '게임 규칙.pdf',
      mime_type: 'application/pdf',
      icon_link: null,
      created_time: '2026-08-17T10:00:00Z',
      modified_time: '2026-08-18T08:00:00Z',
      modified_by: '민우',
      web_view_link: 'https://drive.google.com/file/file-1',
      last_synced: NOW,
    })
  })

  it('선택 필드 없으면 null 폴백', () => {
    const row = toDriveFileRow(
      'budget',
      { id: 'file-2', name: '예산안', mimeType: undefined },
      NOW
    )
    expect(row.mime_type).toBeNull()
    expect(row.created_time).toBeNull()
    expect(row.modified_time).toBeNull()
    expect(row.modified_by).toBeNull()
    expect(row.web_view_link).toBeNull()
    expect(row.icon_link).toBeNull()
  })
})
