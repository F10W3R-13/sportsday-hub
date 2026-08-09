'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { MarkdownRenderer } from '@/lib/markdown/renderer'
import { MarkdownEditDialog } from '@/components/editor/markdown-edit-dialog'
import { useUpdateGuidelineSection } from '@/lib/mutations/teams'
import type { Team, TeamId } from '@/lib/types/models'

interface GuidelineSection {
  id: string
  title: string
  order: number
  content_md: string
}

export function GuidelineViewer({
  team,
  teamId,
}: {
  team: Team
  teamId: TeamId
}) {
  const [editingSection, setEditingSection] = useState<GuidelineSection | null>(
    null
  )
  const updateSection = useUpdateGuidelineSection()

  const sections = (team.guideline_doc?.sections ?? []).sort(
    (a, b) => a.order - b.order
  )

  // content_md 는 "## {title}\n{body}" 형태로 저장되어 있어,
  // title 을 h2 로 이미 렌더링하므로 본문 쪽의 첫 헤더 라인을 제거한다 (제목 이중 출력 방지).
  const stripLeadingHeader = (contentMd: string) =>
    contentMd.replace(/^##\s+.+\n?/, '')

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">지침 내용이 없습니다.</p>
    )
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setEditingSection(section)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <MarkdownRenderer content={stripLeadingHeader(section.content_md)} />
        </section>
      ))}

      {editingSection && (
        <MarkdownEditDialog
          open={!!editingSection}
          onClose={() => setEditingSection(null)}
          title={editingSection.title}
          initialContent={stripLeadingHeader(editingSection.content_md)}
          onSave={(content) =>
            updateSection.mutate({
              teamId,
              sectionId: editingSection.id,
              // content_md 는 "## {title}\n{body}" 형태로 저장된다.
              // 다이얼로그에서는 본문만 편집하므로 저장 시 헤더를 다시 붙인다.
              contentMd: `## ${editingSection.title}\n${content}`,
            })
          }
        />
      )}
    </div>
  )
}
