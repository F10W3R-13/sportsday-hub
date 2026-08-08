import { MarkdownRenderer } from '@/lib/markdown/renderer'
import type { Team } from '@/lib/types/models'

export function GuidelineViewer({ team }: { team: Team }) {
  const sections = team.guideline_doc.sections ?? []
  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        지침 내용이 없습니다.
      </p>
    )
  }
  return (
    <div className="space-y-8">
      {sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <section key={section.id} className="space-y-2">
            <MarkdownRenderer content={section.content_md} />
          </section>
        ))}
    </div>
  )
}
